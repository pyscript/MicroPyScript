"use strict";
/******************************************************************************
An example of how to do a custom "third party" plugin for PyScript.

Authors:
- Nicholas H.Tollervey (ntollervey@anaconda.org)

Copyright (c) 2022 Anaconda Inc. 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
******************************************************************************/

const XTERMCSS = ".xterm{cursor:text;position:relative;user-select:none;-ms-user-select:none;-webkit-user-select:none}.xterm.focus,.xterm:focus{outline:none}.xterm .xterm-helpers{position:absolute;top:0;z-index:5}.xterm .xterm-helper-textarea{padding:0;border:0;margin:0;position:absolute;opacity:0;left:-9999em;top:0;width:0;height:0;z-index:-5;white-space:nowrap;overflow:hidden;resize:none}.xterm .composition-view{background:#000;color:#FFF;display:none;position:absolute;white-space:nowrap;z-index:1}.xterm .composition-view.active{display:block}.xterm .xterm-viewport{background-color:#000;overflow-y:scroll;cursor:default;position:absolute;right:0;left:0;top:0;bottom:0}.xterm .xterm-screen{position:relative}.xterm .xterm-screen canvas{position:absolute;left:0;top:0}.xterm .xterm-scroll-area{visibility:hidden}.xterm-char-measure-element{display:inline-block;visibility:hidden;position:absolute;top:0;left:-9999em;line-height:normal}.xterm.enable-mouse-events{cursor:default}.xterm .xterm-cursor-pointer,.xterm.xterm-cursor-pointer{cursor:pointer}.xterm.column-select.focus{cursor:crosshair}.xterm .xterm-accessibility,.xterm .xterm-message{position:absolute;left:0;top:0;bottom:0;right:0;z-index:10;color:transparent}.xterm .live-region{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.xterm-dim{opacity:0.5}.xterm-underline-1{text-decoration:underline}.xterm-underline-2{text-decoration:double underline}.xterm-underline-3{text-decoration:wavy underline}.xterm-underline-4{text-decoration:dotted underline}.xterm-underline-5{text-decoration:dashed underline}.xterm-strikethrough{text-decoration:line-through}.xterm-screen .xterm-decoration-container .xterm-decoration{z-index:6;position:absolute}.xterm-decoration-overview-ruler{z-index:7;position:absolute;top:0;right:0;pointer-events:none}.xterm-decoration-top{z-index:2;position:relative}";

const pyReplTag = function(e) {
    /*
    Adds a REPL to the DOM. The REPL session is only initialised when the
    runtime is ready. The content of the REPL is inserted in the following
    arrangement of tags:

    <pre class="pyscriptREPL"><code>
    </code></pre>

    No styling is provided by this plugin (the browser defaults for this
    arrangement of tags will make it look like a TTY session). Bespoke CSS
    should use the pyscriptREPL class to attach styling.
    */

    // Eventually binds to the runtime, once started.
    let availableRuntime = null;

    // To hold the textual content of the REPL in the DOM.
    const terminal = document.createElement("div");

    // To become the instance of xterm.js
    let term = null;

    function onPrint(e) {
        /*
        Handle print to stdout events.
        */
        if (term) {
            term.write(e.detail);
        }
    }

    function onLoaded(e) {
        term = new Terminal();
        term.onData(data => availableRuntime.stdin(data));
        term.open(terminal);
    }

    const plugin = {
        name: "py-repl",
        configure: function(config) {
            // Just set a flag to indicate that a REPL is active.
            config.repl = true
            // Load xterm.js
            const xtermElement = document.createElement("script");
            xtermElement.src = "lib/xterm.js";
            xtermElement.onload = function(e) {
                const pyXtermLoaded = new CustomEvent("py-xterm-loaded");
                document.dispatchEvent(pyXtermLoaded);
            };
            var head = document.getElementsByTagName('head')[0];
            head.appendChild(xtermElement);
            document.addEventListener("py-xterm-loaded", onLoaded);
        },
        start: function(config) {
            // Define the py-repl element.
            class PyREPL extends HTMLElement {
                connectedCallback() {
                    /*
                    Create a shadow DOM with the expected child elements and
                    event handlers defined in it.
                    */
                    const shadow = this.attachShadow({ mode: "open" });
                    const xtermCssElement = document.createElement("style");
                    xtermCssElement.textContent = XTERMCSS;
                    shadow.appendChild(xtermCssElement);
                    shadow.appendChild(terminal);
                    document.addEventListener("py-print", onPrint);
                }
            }
            customElements.define("py-repl", PyREPL);
        },
        onRuntimeReady: function(config, runtime) {
            // Store a reference to the runtime, and start the REPL session.
            availableRuntime = runtime;
            availableRuntime.startREPL();
        }
    };

    window.pyScript.registerPlugin(plugin);
};
document.addEventListener("py-configured", pyReplTag);
