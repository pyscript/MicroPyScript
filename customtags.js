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

    const plugin = {
        name: "py-repl",
        configure: function(config) {
            // Just set a flag to indicate that a REPL is active.
            config.repl = true
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
                    const pre = document.createElement("pre");
                    pre.setAttribute("class", "pyscriptREPL");
                    const code = document.createElement("code");
                    pre.appendChild(code);
                    shadow.appendChild(pre);
                }
            }
            customElements.define("py-repl", PyREPL);
        },
        onRuntimeReady: function(config, runtime) {
            // 
        }
    };

    window.pyScript.registerPlugin(plugin);
};
document.addEventListener("py-configured", pyReplTag);
