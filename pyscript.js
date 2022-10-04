"use strict";

class PyScript extends HTMLElement {

    connectedCallback() {
        var code = this.textContent;
        this.textContent = "";
        // MicroPython things happen here...
        mp_js_stdout.addEventListener('print', function(e) {
            this.innerText = this.innerText + e.data;
        }, false);
        var mp_js_startup = Module['onRuntimeInitialized'];
        Module["onRuntimeInitialized"] = async function() {
            mp_js_startup();
            mp_js_init(64 *1024);
            mp_js_do_str(code);
        }

    }
}

customElements.define('py-script', PyScript);
