import XElement from '../../lib/x-element/x-element.js';
import Iqons from '../../../node_modules/@nimiq/iqons/dist/iqons.min.js';
import ValidationUtils from '../../lib/validation-utils.js';

Iqons.svgPath = '../node_modules/@nimiq/iqons/dist/iqons.min.svg';

export default class XIdenticon extends XElement {

    html() {
        return '<img width="100%" height="100%">';
    }

    onCreate() {
        this.$img = this.$('img');
        this.placeholderColor = 'white';
    }

    _onPropertiesChanged() {
        this.address = this.properties.address;
    }

    set placeholderColor(color) {
        this._placeholderColor = color;
        this.address = this._address; // rerender
    }

    set address(address) {
        this._address = address;
        if (ValidationUtils.isValidAddress(address)) {
            Iqons.toDataUrl(address.toUpperCase()).then(dataUrl => this.$img.src = dataUrl);
        } else {
            this.$img.src = Iqons.placeholderToDataUrl(this._placeholderColor, Infinity);
        }
    }

    get address() {
        return this._address;
    }

    set addressAsSvg(address) {
        // also clears the inner html of this tag
        if (ValidationUtils.isValidAddress(address)) {
            Iqons.render(address, this.$el);
        } else {
            Iqons.renderPlaceholder(this.$el, this._placeholderColor, Infinity);
        }
    }
}
