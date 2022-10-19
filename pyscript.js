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

const main = function() {
    /**************************************************************************
    The core PyScript app definition.

    Its main concern is to:

    * Keep the bare minimum of state.
    * Load and process any configuration from the page.
    * Provide a mechanism for PyScriptPlugin based plugins to be registered,
      configured and then started.
    * Load and start the Python runtime.
    * Dispatch the following events to signal various changes in state or the
      completion of tasks (such as starting the runtime).
        - "py-configured", when configuration is processed.
        - "py-plugin-registered", when a plugin is registered.
        - "py-runtime-loaded", when the runtime has been downloaded.
        - "py-runtime-ready", when the runtime is ready to process Python.
    * Define, configure and start the built-in PyScript plugins (e.g. the 
      <py-script> tag).
    **************************************************************************/

    const logger = function() {
        /*
        Really simple logging. Emoji 🐍 highlights PyScript app logs. ;-)
        */
        return Function.prototype.bind.call(console.log, console, "🐍 ", ...arguments);
    }();
    logger("Starting PyScript. 👋");

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
            Dispatch the py-runtime-ready event (for when the runtime has
            eventually started and is ready to evaluate code).
            */
            const pyRuntimeReady = new CustomEvent("py-runtime-ready", this);
            document.dispatchEvent(pyRuntimeReady);
        }

        start(config) {
            /*
            Instantiate, setup, configure and do whatever else is needed to
            start the runtime. This is called once the runtime is loaded into
            the browser.
            */
        }

        eval(script) {
            /*
            Use the runtime to evaluate the script.code.
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

    // The innerHTML of the default splash screen to show while PyScript is
    // starting up. Currently the page is greyed out and the words
    // "Loading PyScript...".
    const defaultSplash= '<div style="position:fixed;width:100%;height:100%;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.5);z-index:99999;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);color:white;font-family:monospace;font-size:10px;">Loading PyScript...</div></div>';

    /**************************************************************************
    Built-in plugins and runtimes.
    **************************************************************************/

    const pyScriptTag = function(){

        // Contains Python scripts found on the page.
        const scripts = [];

        // Contains Python scripts whose source code is available, and pending 
        // evaluation by the runtime.
        const pendingScripts = [];

        // Eventually references the available runtime, once ready.
        var availableRuntime = null;

        function registerScript(e) {
            /*
            Add a Python script to the scripts array. If required load the code
            by fetching it from the URL found in the script's src attribute.
            */
            const script = e.detail;
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
        }

        function scriptLoaded(e) {
            /*
            The given script is ready to be evaluated.

            Either queue it for later evaluation if the runtime isn't ready
            yet, or dispatch the py-eval-script event to signal to the runtime
            it should evaluate the script.
            */
            if (availableRuntime) {
                // Runtime is ready, so evaluate the code.
                const pyEvalScript = new CustomEvent("py-eval-script", {detail: e.detail});
                document.dispatchEvent(pyEvalScript);
            } else {
                // No runtime, so add to pendingScripts queue, to be evaluated
                // once the runtime is ready.
                pendingScripts.push(e.detail);
            }
        }

        function evaluateScript(e) {
            /*
            Given the runtime is ready AND the script is loaded,
            evaluate the script with the runtime.
            */
            logger("Evaluating code. 🤖\n" + e.detail.code);
            availableRuntime.eval(e.detail);
        }

        document.addEventListener("py-script-registered", registerScript);
        document.addEventListener("py-script-loaded", scriptLoaded);
        document.addEventListener("py-eval-script", evaluateScript);

        // The object to contain the various functions needed to handle the
        // life cycle of this plugin, returned to the PyScript environment.
        const plugin = {
            name: "py-script",
            start: function(config) {
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
            },
            onRuntimeReady: function(config, runtime) {
                availableRuntime = runtime;
                // Evaluate any pending scripts.
                pendingScripts.forEach(function(script) {
                    const pyEvalScript = new CustomEvent("py-eval-script", {detail: script});
                    document.dispatchEvent(pyEvalScript);
                })
                // Empty pendingScripts.
                pendingScripts.splice(0, pendingScripts.length);
            }
        }
        return plugin;
    }();

    class MicroPythonRuntime extends Runtime {
        /*
        MicroPython (https://micropython.org) is a lean and efficient
        implementation of the Python 3 programming language that includes a
        small subset of the Python standard library and is optimised to run on
        microcontrollers and in constrained environments. 
        */

        static get url() {
            return "mpbuild/micropython.js";
        }

        start(config) {
            let mp_memory = 1024 * 1024;  // 1Mb
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

        eval(script) {
            mp_js_do_str(script.code);
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

    class PyodideRuntime extends Runtime {
        /*
        Pyodide if a Python distribution for the browser, compiled to WASM. For
        more information, see:

        https://pyodide.org/en/stable/

        TODO: Finish this. It's a hack!
        */

        static get url() {
            return "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js";
        }

        start(config) {
            const stdout_func = function(output) {
                if (output === "Python initialization complete") {
                    return;
                }
                mp_js_stdout.innerText += output + "\n";
            };
            async function main() {
                let pyodide = await loadPyodide({
                    stdout: stdout_func
                });
                return pyodide;
            }
            let pyodideReadyPromise = main();
            const myself = this;
            pyodideReadyPromise.then(result => {
                myself.pyodide = result;
                Runtime.ready()
            });
        }

        eval(script) {
            this.pyodide.runPython(script.code);
        }
    }

    // An object to represent the PyScript platform in the browser. What is
    // eventually returned from the main() function.
    const PyScript = {
    }

    // Default configuration settings for PyScript. These may be overridden by
    // the app.loadConfig function.
    const config = {
        "runtime": "micropython",  // Numpty default.
        "splash": defaultSplash  // loading message in grey overlay.
    }

    // Contains plugins to the PyScript context.
    const plugins = [];

    // Details of runtimes.
    // Key: lowercase runtime name.
    // Value: the class wrapping that version of the runtime.
    const runtimes = {
        "micropython": MicroPythonRuntime,
        "cpython": CPythonRuntime,
        "pyodide": PyodideRuntime
    }

    // Eventually references an instance of the Runtime class, representing the
    // started runtime.
    let runtime = null;

    // Flag to indicate the runtime is ready to evaluate scripts.
    let runtimeReady = false;

    // To hold a reference to the div containing the start-up splash screen
    // displayed while PyScript starts up.
    let splashElement = null;

    function loadConfig() {
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
    }

    function splashOn() {
        /*
        Display the splash screen for when PyScript is starting.
        */
        splashElement = document.createElement("div");
        splashElement.innerHTML = config.splash;
        const body = document.getElementsByTagName('body')[0];
        body.appendChild(splashElement);
    }

    function splashOff() {
        /*
        Remove the splash screen, once PyScript is finished starting.
        */
        splashElement.parentNode.removeChild(splashElement);
    }

    function registerPlugin(plugin) {
        /*
        Add a plugin to the PyScript context, after calling its configure
        method.
        */
        logger(`Registering plugin "${plugin.name}" 🔌`);
        plugin.configure?.(config);
        plugins.push(plugin);
        if (runtimeReady) {
            startPlugin(plugin)
            plugin.onRuntimeReady?.(config, runtime);
        }
        const pyPluginRegistered = new CustomEvent("py-plugin-registered", {detail: { config: config, plugin: plugin}});
        document.dispatchEvent(pyPluginRegistered);
    }

    function startPlugins() {
        /*
        Start all registered plugins.
        */
        plugins.forEach(function(plugin) {
            startPlugin(plugin);
        })
    }

    function startPlugin(plugin) {
        /*
        Start an individual plugin.
        */
        logger(`Starting plugin "${plugin.name}" ⚡`);
        plugin.start?.(config);
        const pyPluginStarted = new CustomEvent("py-plugin-started", {detail: { config: config, plugin: plugin}});
        document.dispatchEvent(pyPluginStarted);
    }

    function loadRuntime() {
        /*
        Given a configuration state, load the runtime specified therein and
        dispatch a py-runtime-loaded event when done.

        TL;DR - a new script tag with the correct src is added to the head.
        */
        if(!runtimes.hasOwnProperty(config.runtime)) {
            throw `💥 Unknown runtime: "${config.runtime}" (known runtimes: ${Object.keys(runtimes)})`;
        }
        const runtimeElement = document.createElement("script");
        runtimeElement.src = runtimes[config.runtime.toLowerCase()].url;
        runtimeElement.onload = function(e) {
            logger(`Runtime "${config.runtime}" loaded. 👍`);
            const pyRuntimeLoaded = new CustomEvent("py-runtime-loaded", {detail: config.runtime});
            document.dispatchEvent(pyRuntimeLoaded);
        };
        var head = document.getElementsByTagName('head')[0];
        logger(`Loading runtime "${config.runtime}". 🚀`)
        head.appendChild(runtimeElement);
    }

    function startRuntime() {
        /*
        Configure and start the Python runtime.
        */
        runtime = new runtimes[config.runtime.toLowerCase()]();
        runtime.start(config);
    }

    function runtimeStarted() {
        /*
        The runtime is ready to go, so flip the runtimeReady flag, step
        through each registered plugin's onRuntimeReady method, and begin
        evaluating any code in the pendingScripts queue.
        */
        logger(`Runtime started. 🎬`);
        runtimeReady = true;
        plugins.forEach(function(plugin) {
            plugin.onRuntimeReady?.(config, runtime);
        });
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
            - Register the default plugins (currently only pyScriptTag), so
              they can modify the config if required.
            - Load the Python runtime into the browser.
            - Display the splash screen.
        */
        registerPlugin(pyScriptTag);
        loadRuntime();
        splashOn();
    }

    function onRuntimeLoaded(e) {
        /*
        The runtime has loaded over the network.
            - Freeze the config so it can't be changed from this point.
            - Start the runtime in this PyScript context.
            - Start the plugins to kick off Pythonic aspects of the page.
        */
        startRuntime();
        startPlugins();
    }

    function onRuntimeReady(e) {
        /*
        The runtime is ready to evaluate scripts.
            - Remove the splash screen.
            - Kick off all the pending things needed now it's all started up.
        */
        splashOff();
        runtimeStarted();
    }

    // Finally, return a function to start PyScript.
    return function() {
        // Check to bypass loadConfig, for testing purposes.
        if (!window.pyscriptTest) {
            document.addEventListener("py-configured", onPyConfigured);
            document.addEventListener("py-runtime-loaded", onRuntimeLoaded);
            document.addEventListener("py-runtime-ready", onRuntimeReady);
            loadConfig();
        }
        // An object to represent the PyScript platform in the browser. What is
        // eventually returned from the main() function.
        const pyScript = {
            get config() {
                return config;
            },
            get plugins() {
                return plugins;
            },
            get availableRuntimes() {
                return runtimes;
            },
            get runtime() {
                return runtime;
            },
            get isRuntimeReady() {
                return runtimeReady;
            },
            registerPlugin: function(plugin) {
                registerPlugin(plugin);
            },
            runPython: function(code) {
                if (runtimeReady) {
                    runtime.eval(code);
                }
            }
        };
        return pyScript;
    }
}();


/******************************************************************************
Start PyScript.
******************************************************************************/
window.pyScript = main();
