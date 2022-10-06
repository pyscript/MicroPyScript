"use strict";
/******************************************************************************
MicroPyscript.

A small, simple, single file kernel of PyScript, made for testing purposes.

See the README for more details, design decisions, and an explanation of how
things work.

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


/******************************************************************************
Base classes and constants.
******************************************************************************/
class Plugin {
    /*
    Defines a "plugin" in PyScript.
    */

    configure(config) {
        /*
        Give the plugins early access to the config. Potentially, they can
        modify it, and modifications will be visible to later steps.

        Example of things which plugins might want to do:
            - early sanity check about their own options
            - rename/remap some options
            - add new packages to install
            - register new runtime engines
            - modify options for other plugins (e.g.: a 'debugger' plugin
              might set the option 'always_show_the_terminal' or something
              like that)
        */
    }

    start(config) {
        /*
        Main entry point for plugins. At this point, config should be
        considered finalized.

        Examples:
            - define custom elements
            - start fetching external resources
        */
    }

    onRuntimeReady(config, runtime) {
        /*
        Called once the runtime is ready to execute commands

        Examples:
            - pip install packages
            - import/initialize python plugins
        */
    }
}


class Runtime {
    /*
    Defines and encapsulates a runtime used by PyScript to evaluate Python
    code or run an interactive REPL.
    */

    static get url() {
        /*
        The URL pointing to where to download the runtime.
        */
        return "";
    }

    static ready() {
        /*
        Dispatch the py-runtime-ready event (when the runtime has started).
        */
        const pyRuntimeReady = new CustomEvent("py-runtime-ready");
        document.dispatchEvent(pyRuntimeReady);
    }

    start(config) {
        /*
        Instantiate, setup, configure and do whatever else is needed to start
        the runtime.
        */
    }

    eval(script) {
        /*
        Use the runtime to evaluate a script.
        */
    }

    startREPL() {
        /*
        Start an interactive REPL session with the runtime.
        */
    }

    stdin(input) {
        /*
        Pass the input into the runtime's stdin.
        */
    }
}


const splashInnerHTML = '<svg class="whole" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" height="48" width="48"><g id="loader"><animateTransform xlink:href="#loader" attributeName="transform" attributeType="XML" type="rotate" from="0 50 50" to="360 50 50" dur="1s" begin="0s" repeatCount="indefinite" restart="always"></animateTransform><path class="a" opacity="0.2" fill-rule="evenodd" clip-rule="evenodd" d="M50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0C22.3858 0 0 22.3858 0 50C0 77.6142 22.3858 100 50 100ZM50 90C72.0914 90 90 72.0914 90 50C90 27.9086 72.0914 10 50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90Z" fill="#999999"></path><path class="b" fill-rule="evenodd" clip-rule="evenodd" d="M100 50C100 22.3858 77.6142 0 50 0V10C72.0914 10 90 27.9086 90 50H100Z" fill="#999999"></path></g></svg>';


/******************************************************************************
Built-in plugins and runtimes.
******************************************************************************/
class PyScriptTag extends Plugin {
    start(config) {
        // Define the PyScript element.
        class PyScript extends HTMLElement {
            connectedCallback() {
                /*
                All code is dispatched as a py-script-registered event
                for later processing.

                Additional metadata if available:
                    - the src value for remote source file
                    - this element as target
                */
                const code = this.textContent;
                this.textContent = "";
                const script = {
                    code: code.trim() ? code : "",
                    src: this.attributes.src ? this.attributes.src.value : "",
                    target: this
                };
                const pyScriptRegistered = new CustomEvent("py-script-registered", {"detail": script});
                document.dispatchEvent(pyScriptRegistered);
            }
        }
        // Register it (thus extracting the code from the page).
        customElements.define('py-script', PyScript);
    }
}


class MicroPythonRuntime extends Runtime {
    /*
    MicroPython (https://micropython.org) is a lean and efficient
    implementation of the Python 3 programming language that includes a small
    subset of the Python standard library and is optimised to run on
    microcontrollers and in constrained environments. 
    */

    static get url() {
        return "mpbuild/micropython.js";
    }

    start(config) {
        let mp_memory = 64 * 1024;  // 64K
        if(config.mp_memory) {
            mp_memory = config.mp_memory;
        }
        // TODO: Fix this.
        mp_js_stdout.addEventListener('print', function(e) {
            this.innerText = this.innerText + e.data;
        }, false);
        let mp_js_startup = Module['onRuntimeInitialized'];
        Module["onRuntimeInitialized"] = async function() {
            mp_js_startup();
            mp_js_init(mp_memory);
            Runtime.ready();
        }
    }

    eval(code) {
        mp_js_do_str(code);
    }

    startREPL() {
        mp_js_init_repl();
    }

    stdin(input) {
        const bytes = Uint8Array.from(input.split("").map(x => x.charCodeAt()));
        bytes.forEach(function(b) {
            mp_js_process_char(b);
        });
    }
}


class CPythonRuntime extends Runtime {
    /*
    The standard CPython version of Python compiled to WASM. For more
    information, see:

    https://github.com/python/cpython/blob/main/Tools/wasm/README.md

    TODO: Finish this.
    */

    static get url() {
        return "pybuild/python.js";
    }
}


/******************************************************************************
The core PyScript app definition.
******************************************************************************/
const main = function() {
    // Really simple logging. Emoji 🐍 highlights PyScript app logs. ;-)
    const logger = function() {
        return Function.prototype.bind.call(console.log, console, "🐍 ", ...arguments);
    }();
    logger("Starting PyScript. 👋")

    // Default configuration settings for PyScript. These may be overridden by
    // the app.loadConfig function.
    const config = {
        "runtime": "micropython"  // Numpty default.
    }

    // Contains plugins to the PyScript context.
    const plugins = [];

    // Contains Python scripts found on the page.
    const scripts = [];

    // Contains Python scripts whose source code is available, and pending 
    // evaluation by the runtime.
    const pendingScripts = [];

    // Details of runtimes.
    // Key: lowercase runtime name.
    // Value: the class wrapping that version of the runtime.
    const runtimes = {
        "micropython": MicroPythonRuntime,
        "cpython": CPythonRuntime
    }
    // Default to smallest/fastest runtime.
    runtimes["default"] = runtimes["micropython"]

    // Eventually references an instance of the Runtime class, representing the
    // started runtime.
    let runtime = null;

    // Flag to indicate the runtime is ready to evaluate scripts.
    let runtimeReady = false;

    // The app object contains "public" functions to change the state of
    // private variables within this function/closure.
    const app = {
        loadConfig: function() {
            /*
            Loads configuration for running PyScript from JSON contained in the
            py-config element. Updates the default config object. Dispatches a
            py-configured event when done.
            */
            let userConf = {};
            const element = document.querySelector('py-config');
            if (element) {
                userConf = JSON.parse(element.textContent);
                element.textContent = "";
            } 
            Object.keys(userConf).forEach((key) => {
                config[key] = userConf[key];
            });
            logger("Loaded configuration. ✅", config);
            const pyConfigured = new CustomEvent("py-configured", {detail: config});
            document.dispatchEvent(pyConfigured);
        },
        registerPlugin: function(plugin) {
            /*
            Add a plugin to the PyScript context, after calling its configure
            method.
            */
            logger(`Registering plugin "${plugin.constructor.name}" 🔌`);
            plugin.configure(config);
            plugins.push(plugin);
        },
        startPlugins: function() {
            /*
            Start all registered plugins.
            */
            plugins.forEach(function(plugin) {
                logger(`Starting plugin "${plugin.constructor.name}" ⚡`);
                plugin.start(config);
            })
        },
        loadRuntime: function() {
            /*
            Given a configuration state, load the runtime specified therein and
            dispatch a py-runtime-loaded event when done.

            TL;DR - a new script tag with the correct src is added to the head.
            */
            const runtimeName = config.runtime ? config.runtime : "default";
            if(!runtimes.hasOwnProperty(runtimeName)) {
                throw `💥 Unknown runtime: "${runtimeName}" (known runtimes: ${Object.keys(runtimes)})`;
            }
            const runtimeElement = document.createElement("script");
            runtimeElement.src = runtimes[runtimeName.toLowerCase()].url;
            runtimeElement.onload = function(e) {
                logger(`Runtime "${runtimeName}" loaded. 👍`)
                const pyRuntimeLoaded = new CustomEvent("py-runtime-loaded", {detail: runtimeName});
                document.dispatchEvent(pyRuntimeLoaded);
            };
            var head = document.getElementsByTagName('head')[0];
            logger(`Loading runtime "${runtimeName}". 🚀`)
            head.appendChild(runtimeElement);
        },
        startRuntime: function() {
            /*
            Congigure and start the Python runtime.
            */
            const runtimeName = config.runtime ? config.runtime : "default";
            runtime = new runtimes[runtimeName.toLowerCase()]();
            runtime.start(config);
        },
        runtimeStarted: function() {
            /*
            The runtime is ready to go, so flip the runtimeReady flag, step
            through each registered plugin's onRuntimeReady method, and begin
            evaluating any code in the pendingScripts queue.
            */
            logger(`Runtime started. 🎬`)
            runtimeReady = true;
            plugins.forEach(function(plugin) {
                plugin.onRuntimeReady(config, runtime);
            });
            pendingScripts.forEach(function(script) {
                const pyEvalScript = new CustomEvent("py-eval-script", {detail: script});
                document.dispatchEvent(pyEvalScript);
            })
            // Empty pendingScripts.
            pendingScripts.splice(0, pendingScripts.length);
        },
        registerScript(script) {
            /*
            Add a Python script to the scripts array. If required load the code
            by fetching it from the URL found in the script's src attribute.
            */
            // Ignore code that is just whitespace.
            script.code = script.code.trim() ? script.code : "";
            logger("Registered script. 📄", script);
            scripts.push(script);
            if (script.code) {
                // The script's code was inline.
                const pyLoadedScript = new CustomEvent("py-script-loaded", {detail: script});
                document.dispatchEvent(pyLoadedScript);
            } else if (script.src) {
                // Handle asynchronous loading of the script's code from the
                // URL in src.
                fetch(script.src).then(function(response) {
                    logger(`Fetched script from "${script.src}" 📡`, response);
                    if (response.ok) {
                        response.text().then((data) => {
                            script.code = data;
                            logger("Updated script code. 📄", script);
                            const pyLoadedScript = new CustomEvent("py-script-loaded", {detail: script});
                            document.dispatchEvent(pyLoadedScript);
                        })
                    } else {
                        // Abort.             
                        throw `💥 Cannot load script from "${script.src}"`;
                    }
                });
            } else {
                // Warn that a script has no source code either inline or via
                // the src attribute.
                logger("Script has no source code. ⁉️😕", script);
            }
        },
        loadScript(script) {
            /*
            The given script is either queued for later evaluation if the
            runtime isn't ready yet, or the py-eval-script event is
            dispatched so the runtime can evaluate it.
            */
            if (runtimeReady) {
                // Runtime is ready, so evaluate the code.
                const pyEvalScript = new CustomEvent("py-eval-script", {detail: script});
                document.dispatchEvent(pyEvalScript);
            } else {
                // No runtime, so add to pendingScripts queue, to be evaluated
                // once the runtime is ready.
                pendingScripts.push(script);
            }
        },
        evaluateScript(script) {
            /*
            Given the runtime is ready AND the scripts are all loaded,
            evaluate each script in turn with the runtime.
            */
            logger("Evaluating code. 🤖\n" + script.code);
            runtime.eval(script.code);
        },
    }


    // The following functions coordinate the unfolding of PyScript as various
    // events are dispatched and state evolves to trigger the next steps.
    //
    // These functions are defined in the order they're roughly expected to
    // be called through the life-cycle of the page, although this cannot be
    // guaranteed for some of the functions.
    function onPyConfigured(e) {
        /*
        Once PyScript has loaded its configuration:
            - register the default plugins (currently only PyScriptTag), so
              they can modify the config if required.
            - freeze the config so it can't be changed from this point.
            - load the Python runtime into the browser.
            - start the plugins to kick off extracting Python scripts from the
              page.
        */
        app.registerPlugin(new PyScriptTag());
        Object.freeze(config);
        logger("Frozen config. ❄️", config);
        app.loadRuntime();
        app.startPlugins();
    }
    document.addEventListener("py-configured", onPyConfigured);


    function onPyScriptRegistered(e) {
        /*
        A plugin has, in some way, detected a Python script definition.

        Register metadata about the script via the dispatched event's detail.
        */
        app.registerScript(e.detail);
    }
    document.addEventListener("py-script-registered", onPyScriptRegistered);


    function onPyScriptLoaded(e) {
        /*
        The source of a Python script has been obtained either as inline code
        or as the content of a remote Python source file that has been fetched
        over the network.

        The source code is included as metadata in the dispatched event's
        detail. So signal to the app the script is fully loaded.
        */
        app.loadScript(e.detail);
    }
    document.addEventListener("py-script-loaded", onPyScriptLoaded);


    function onRuntimeLoaded(e) {
        /*
        The runtime has loaded over the network. Next, start the runtime in
        this PyScript context.
        */
        app.startRuntime();
    }
    document.addEventListener("py-runtime-loaded", onRuntimeLoaded);


    function onRuntimeReady(e) {
        /*
        The runtime is ready to evaluate scripts.
        */
        app.runtimeStarted();
    }
    document.addEventListener("py-runtime-ready", onRuntimeReady);


    function onEvalScript(e) {
        /*
        Handle the event designating a script is ready to be evaluated by the
        runtime.
        */
        app.evaluateScript(e.detail)
    }
    document.addEventListener("py-eval-script", onEvalScript);


    // Finally, return a function to start PyScript.
    return function() {
        // Check to bypass loadConfig, for testing purposes.
        if (!window.pyscriptTest) {
            app.loadConfig();
        }
        return app;
    }
}();


/******************************************************************************
Start PyScript.
******************************************************************************/
main();
