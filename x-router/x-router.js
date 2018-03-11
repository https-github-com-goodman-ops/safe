import XElement from '/libraries/x-element/x-element.js';
import Router from '/libraries/es6-router/src/index.js';

export default class XRouter extends XElement {

    //constructor(parent) { super(parent); }

    onCreate() {
        this.reverse = false;
        this.router = new Router({ debug: true, startListening: false });
        //console.log(JSON.stringify(this.router.routes[0].route));
        this.parseRoutes(this.$$('x-route'));
        console.log(JSON.stringify(this.router.routes[0].route));
        this.router.listen();
        this.addEventListener('animationend', e => {
            console.log('animationend');
            this._toggleInOut(this.previous, false, false);
            this._toggleInOut(this.current, false, false);
            this._setClass(this.current, 'in', true);
            //this.reverse = false;
        });
    }

    parseRoutes(routeElements) {
        this.routes = {};
        for (const element of routeElements) {
            const path = element.attributes.path.value.trim();
            if (!path || path === '' || path ==='/') { // root
                this.routes._root = { path, element }
                this.router.add(() => {
                    console.log('root route', path);
                    this._show('_root');
                });
            } else {
                this.routes[path] = { path, element, regex: new RegExp(path) }
                this.router.add(new RegExp(path), () => {
                    this._show(path);
                    console.log('normal route', path);
                });
            }
        }
    }

    goTo(path) {
        this.reverse = false;
        this.router.navigate(path);
    }

    goBackTo(path) {
        this.reverse = true;
        this.router.navigate(path);
    }

    _show(path) {
        if (path === this.current) return
        this._setClass(this.current, 'in', false);
        this._toggleInOut(this.current, false)
        this._toggleInOut(path, true);
        [ this.previous, this.current ] = [ this.current, path ];
    }

    _toggleInOut(path, setIn, setOut = !setIn) {
        //this.setClass(path, this.reverse ? 'from-right-in' : 'from-left-in', setIn);
        //this.setClass(path, this.reverse ? 'from-left-out' : 'from-right-out', setOut);
        this._setClass(path, 'from-left-in', setIn && this.reverse);
        this._setClass(path, 'from-right-in', setIn && !this.reverse);
        this._setClass(path, 'from-right-out', setOut && this.reverse);
        this._setClass(path, 'from-left-out', setOut && !this.reverse);
    }

    _setClass(path, css, on) {
        if (this.routes[path]) this.routes[path].element.classList.toggle(css, on);
    }
}
