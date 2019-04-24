import AccountType from './lib/account-type.js';
import networkClient from './network-client.js';

export const TypeKeys = {
    ADD_ACCOUNT: 'wallet/add-account',
    LOGIN: 'wallet/login',
    LOGOUT: 'wallet/logout',
    REMOVE_ACCOUNT: 'wallet/remove-account',
    POPULATE: 'wallet/populate',
    SET_WORDS_FLAG: 'wallet/set-words-flag',
    SET_FILE_FLAG: 'wallet/set-file-flag',
    SWITCH: 'wallet/switch',
    UPDATE_ACCOUNT_LABEL: 'wallet/update-account-label',
    UPDATE_BALANCES: 'wallet/update-balances',
    UPDATE_WALLET_LABEL: 'wallet/update-wallet-label',
};

export const LEGACY = 'LEGACY';

export const WalletType = {
    LEGACY: 1,
    BIP39: 2,
    LEDGER: 3,
};

export const initialState = {
    wallets: new Map(),
    accounts: new Map(),
    loading: false,
    hasContent: false,
    activeWalletId: undefined
};

/* Helper functions */

function updateMapItem(map, id, update) {
    return new Map(map).set(
        id,
        Object.assign({}, map.get(id), update),
    )
}

function sanitizeActiveWalletId(state) {
    const activeWalletIsEmptyLegacy = state.activeWalletId === LEGACY
        && ![...state.accounts.values()].some(account => account.isLegacy);
    const noActiveWallet = state.activeWalletId !== LEGACY && !state.wallets.get(state.activeWalletId);

    if (activeWalletIsEmptyLegacy || noActiveWallet) {
        // Determine wallet with most accounts and set it as new active wallet
        const walletIdsWithCount = [...state.accounts.values()]
            .map(account => account.isLegacy ? LEGACY : account.walletId)
            .reduce((acc, id) => {
                acc[id] = acc[id] || 0;
                acc[id]++;
                return acc;
            }, {});

        let highestCount = 0;
        for (const id of Object.keys(walletIdsWithCount)) {
            const count = walletIdsWithCount[id];
            if (count > highestCount) {
                state.activeWalletId = id;
                highestCount = count;
            }
        }
    }

    return state;
}

/* Reducer: State machine where changes happen */

export function reducer(state, action) {
    // Dynamic helper function
    function updateState(updatedProperties) {
        const updatedState = Object.assign({}, state, updatedProperties);
        return sanitizeActiveWalletId(updatedState);
    }

    if (state === undefined) {
        return initialState;
    }

    switch (action.type) {
        case TypeKeys.ADD_ACCOUNT:
            const oldEntry = state.accounts.get(action.account.address);

            // Keep balance information we might have
            // TODO: Check if this is still used actually
            return updateState({
                accounts: new Map(state.accounts)
                    .set(action.account.address, Object.assign({}, action.account, {
                        balance: oldEntry ? oldEntry.balance : undefined
                    }))
            });

        case TypeKeys.LOGIN:
            return updateState({
                wallets: new Map(state.wallets).set(action.wallet.id, action.wallet),
                activeWalletId: action.wallet.id,
            });

        case TypeKeys.LOGOUT: {
            // Remove wallet
            const wallets = new Map(state.wallets);
            wallets.delete(action.walletId);

            // Remove wallet's accounts (including contracts)
            const accounts = new Map(state.accounts);
            for (const account of [...state.accounts.values()]) {
                if (account.walletId === action.walletId) {
                    accounts.delete(account);
                }
            }

            return updateState({
                wallets,
                accounts,
            });
        }

        case TypeKeys.POPULATE: {
            const wallets = new Map(state.wallets);
            const accounts = new Map(state.accounts);

            action.listedWallets.forEach(wallet => {
                if (wallet.type !== WalletType.LEGACY) {
                    const entry = {
                        id: wallet.accountId,
                        label: wallet.label,
                        type: wallet.type,
                        fileExported: wallet.fileExported,
                        wordsExported: wallet.wordsExported,
                    };

                    // merge with previous information
                    wallets.set(
                        wallet.accountId,
                        Object.assign({}, wallets.get(wallet.accountId), entry)
                    );
                }

                wallet.addresses.forEach(address => {
                    const entry = {
                        address: address.address,
                        label: address.label,
                        type: wallet.type === WalletType.LEDGER ? AccountType.LEDGER : AccountType.KEYGUARD_HIGH,
                        isLegacy: wallet.type === WalletType.LEGACY,
                        walletId: wallet.accountId,
                    };

                    // merge with previous information
                    accounts.set(
                        address.address,
                        Object.assign({}, accounts.get(address.address), entry)
                    );
                });

                wallet.contracts.forEach(contract => {
                    const entry = Object.assign({}, contract, {
                        type: contract.type === 1 /* Nimiq.Account.Type.VESTING */ ? AccountType.VESTING : AccountType.HTLC,
                        stepAmount: contract.stepAmount / 1e5,
                        totalAmount: contract.totalAmount / 1e5,
                        label: contract.label,
                        owner: contract.owner, // vesting only
                        sender: contract.sender, // HTLC only
                        recipient: contract.recipient, // HTLC only
                        isLegacy: wallet.type === WalletType.LEGACY,
                        walletId: wallet.accountId,
                    });

                    // merge with previous information
                    accounts.set(
                        contract.address,
                        Object.assign({}, accounts.get(contract.address), entry)
                    );
                });
            });

            return updateState({
                hasContent: true,
                wallets,
                accounts,
            });
        }

        case TypeKeys.REMOVE_ACCOUNT: {
            const accounts = new Map(state.accounts);
            accounts.delete(action.address);

            const accountArray = [...accounts.values()];

            const affectedVestingContracts = accountArray.filter(account =>
                account.type === AccountType.VESTING && account.owner === action.address
            );

            const affectedHTLCContracts = accountArray.filter(account =>
                account.type === AccountType.HTLC
                && !accounts.get(account.sender)
                && !accounts.get(account.recipient)
            );

            for (const contract of affectedVestingContracts) {
                accounts.delete(contract.address);
            }

            for (const contract of affectedHTLCContracts) {
                accounts.delete(contract.address);
            }

            return updateState({ accounts });
        }

        case TypeKeys.SET_FILE_FLAG:
            return updateState({
                wallets: updateMapItem(state.wallets, action.id, { fileExported: action.value }),
            });

        case TypeKeys.SET_WORDS_FLAG:
            return updateState({
                wallets: updateMapItem(state.wallets, action.id, { wordsExported: action.value }),
            });

        case TypeKeys.SWITCH:
            return updateState({
                activeWalletId: action.walletId,
            });

        case TypeKeys.UPDATE_ACCOUNT_LABEL:
            return updateState({
                accounts: updateMapItem(state.accounts, action.address, { label: action.label }),
            });

        case TypeKeys.UPDATE_BALANCES: {
            const accounts = new Map(state.accounts);
            for (const [address, balance] of action.balances) {
                accounts.set(address, Object.assign({}, accounts.get(address), { balance }));
            }

            return updateState({ accounts });
        }

        case TypeKeys.UPDATE_WALLET_LABEL:
            // Only update labels of existing entries (prevents adding legacy accounts)
            if (!state.wallets.get(action.walletId)) return state;

            return updateState({
                wallets: updateMapItem(state.wallets, action.walletId, { label: action.label }),
            });


        default:
            return state
    }
}

/* Action creators */

export function addAccount(account) {
    // subscribe at network
    networkClient.client.then(client => client.subscribe(account.address));

    return {
        type: TypeKeys.ADD_ACCOUNT,
        account
    };
}

export function login(wallet) {
    return {
        type: TypeKeys.LOGIN,
        wallet
    }
}
export function logout(walletId) {
    return async (dispatch, getState) => {
        const state = getState();
        const addressesToKeep = [...state.wallets.accounts.values()].filter(account => account.walletId !== walletId);

        dispatch({
            type: TypeKeys.LOGOUT,
            walletId,
            addressesToKeep, // for transaction reducer
        });
    }
}

export function logoutLegacy(walletId) {
    return async (dispatch, getState) => {
        const state = getState();
        const account = [...state.wallets.accounts.values()].find(account => account.walletId === walletId);
        if (!account.isLegacy) throw new Error('Called legacyLogout for non-legacy wallet');

        removeAccount(account.address)(dispatch, getState);
    }
}

export function populate(listedWallets) {
    // subscribe addresses at network
    const addresses = listedWallets.map(wallet => wallet.addresses.map(account => account.address))
        .reduce((acc, addresses) => acc.concat(addresses), []);
    networkClient.client.then(client => client.subscribe(addresses));

    return {
        type: TypeKeys.POPULATE,
        listedWallets,
    };
}

export function removeAccount(address) {
    return async (dispatch, getState) => {
        const state = getState();
        const accountArray = [...state.wallets.accounts.values()];

        // For transactions store: Keep transactions with all addresses...
        const addressesToKeep = accountArray.filter(account => {
            if (account.address === address) return false; // ...but the one to be deleted...
            if (account.type === AccountType.VESTING && account.owner === address) return false; // ...and its contracts
            if (account.type === AccountType.HTLC) {
                const sender = state.wallet.accounts.get(account.sender);
                const recipient = state.wallet.accounts.get(account.recipient);
                if ((!sender || sender.address === address) && (!recipient || recipient.address === address)) return false;
            }
            return true;
        }).map(account => account.address);

        dispatch({
            type: TypeKeys.REMOVE_ACCOUNT,
            address,
            addressesToKeep,
        });
    }
}

export function setFileFlag(id, value) {
    return {
        type: TypeKeys.SET_FILE_FLAG,
        id,
        value
    };
}

export function setWordsFlag(id, value) {
    return {
        type: TypeKeys.SET_WORDS_FLAG,
        id,
        value
    };
}

export function switchWallet(walletId) {
    return {
        type: TypeKeys.SWITCH,
        walletId
    }
}

export function updateAccountLabel(address, label) {
    return {
        type: TypeKeys.UPDATE_ACCOUNT_LABEL,
        address,
        label
    }
}

export function updateBalances(balances) {
    return {
        type: TypeKeys.UPDATE_BALANCES,
        balances
    }
}

export function updateWalletLabel(walletId, label) {
    return {
        type: TypeKeys.UPDATE_WALLET_LABEL,
        walletId,
        label
    }
}
