"use strict";

/******************************************************************************
Base classes.
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

/******************************************************************************
Built-in plugins and runtimes.
******************************************************************************/

class PyScriptTag extends Plugin {
    start(config) {
        // Define the PyScript element.
        class PyScript extends HTMLElement {
            connectedCallback() {
                /*
                All code is dispatched as a "py-code" event with code for later
                processing.

                Additional metadata if available:
                    - this element's id
                    - the src value
                */
                var code = this.textContent;
                this.textContent = "";
                var detail = {}
                detail.code = code.trim() ? code : "";
                if (this.attributes.src) {
                    detail.src = this.attributes.src.value;
                }
                detail.target = this;
                const pyScriptRegistered = new CustomEvent("py-script-registered", {"detail": detail});
                document.dispatchEvent(pyScriptRegistered);
            }
        }
        // Register it (thUs extracting the code from the page).
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

/******************************************************************************
The core PyScript app definition.
******************************************************************************/

function main() {
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
    // Value: path to load runtime.
    const runtimes = {
        "micropython": MicroPythonRuntime,
        "cpython": "pybuild/python.js"
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
            The runtime is ready to go, so flip the runtimeReady flag and begin
            evaluating any code in the pendingScripts queue.
            */
            logger(`Runtime started. 🎬`)
            runtimeReady = true;
            plugins.forEach(function(plugin) {
                plugin.onRuntimeReady(config);
            });
            pendingScripts.reverse();
            pendingScripts.forEach(function(script) {
                const pyEvalScript = new CustomEvent("py-eval-script", {detail: script});
                document.dispatchEvent(pyEvalScript);
            })
            // Empty pendingScripts.
            pendingScripts.splice(0, pendingScripts.length);
        },
        registerScript(script) {
            /*
            Add a Python script to the scripts array, to be run when the
            runtime is ready.
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
                    logger(`Fetch script from "${script.src}" 📡`, response);
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
                logger("Script has no source code. ⁉️", script);
            }
        },
        loadScript(script) {
            /*
            Ensure the source code for all the scripts is available. For any
            code that has a src but no content, will fetch the code from the
            URL in src. Dispatches a py-scripts-loaded event when done.
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
            debugger;
            runtime.eval(script.code);
        },
    }

    // The following functions are used to coordinate the unfolding of PyScript
    // as various events are dispatched and state evolves to trigger the next
    // steps.
    //
    // These functions are defined in the order they're roughly expected to
    // be called through the life-cycle of the page.

    app["run"] = function() {
        /*
        Start everthing running.
        */
        app.loadConfig();
    }

    function onPyConfigured(e) {
        /*
        Once configured, load the runtime, register the default plugins
        (currently only the PyScriptTag), freeze the config and start the
        plugins to kick off extracting Python scripts from the page.
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
        Register a Python script and related metadatacontained in the
        dispatched event's detail.
        */
        app.registerScript(e.detail);
    }
    document.addEventListener("py-script-registered", onPyScriptRegistered);

    function onPyScriptLoaded(e) {
        /*
        The source of a Python script is available as metadata in the
        dispatched event's detail.
        */
        app.loadScript(e.detail);
    }
    document.addEventListener("py-script-loaded", onPyScriptLoaded);

    function onRuntimeLoaded(e) {
        /*
        The runtime has loaded. 
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
        The runtime is ready, and a script's source code is ready, so evaluate
        the script with the runtime!
        */
        app.evaluateScript(e.detail)
    }
    document.addEventListener("py-eval-script", onEvalScript);

    return app;
}

/******************************************************************************
Start PyScript.
******************************************************************************/
const _pyscriptApp = main();
_pyscriptApp.run();
