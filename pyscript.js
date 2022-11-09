"use strict";
/******************************************************************************
MicroPyScript. 🐍

A small, simple, single file kernel of getting scripting languages into the
browser, made for testing purposes and technical exploration.

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
    The core MicroPyScript app definition.

    Its main concern is to:

    * Keep the bare minimum of state.
    * Load and process any configuration from the page.
    * Provide a mechanism for plugins to be registered, configured and then
      started.
    * Load and start the scripting language interpreter.
    * Dispatch the following events to signal various changes in state or the
      completion of tasks (such as starting the interpreter).
        - "py-configured", when configuration is processed.
        - "py-plugin-registered", when a plugin is registered.
        - "py-plugin-started", when a plugin is started.
        - "py-interpreter-loaded", when the interpreter has been downloaded.
        - "py-interpreter-ready", when the interpreter is ready to process
          Python for configuration reasons (such as pip installing modules).
        - "py-file-fetched", when a file, to be added to the interpreter's
          filesystem, has been fetched from the network.
        - "py-files-loaded", when all the files have been copied onto the
          interpreter's filesystem.
        - "py-finished-setup", when the interpreter and filesystem are both
          ready. At this point, PyScript is ready to evaluate user's code.
    * Define, configure and start built-in MicroPyScript plugins (e.g. the 
      <py-script> tag).
    **************************************************************************/

    const logger = function() {
        /*
        Really simple logging. Emoji 🐍 highlights MicroPyScript app logs. ;-)
        */
        return Function.prototype.bind.call(console.log, console, "🐍 ", ...arguments);
    }();
    logger("Starting MicroPyScript. 👋🐍");

    class Interpreter {
        /*
        Defines and encapsulates a interpreter used by MicroPyScript to evaluate
        code or run an interactive REPL with a scripting language compiled to
        WASM.
        */

        static get url() {
            /*
            The URL pointing to where to download the interpreter.
            */
            return "";
        }

        static ready() {
            /*
            Dispatch the py-interpreter-ready event (for when the interpreter has
            eventually started and is ready to evaluate code).
            */
            const pyInterpreterReady = new CustomEvent("py-interpreter-ready", this);
            document.dispatchEvent(pyInterpreterReady);
        }

        static print(output) {
            /*
            Dispatch the py-print event (for when output is printed to stdout).
            */
            const pyPrint = new CustomEvent("py-print", {detail: output})
            document.dispatchEvent(pyPrint);
        }

        start(config) {
            /*
            Instantiate, setup, configure and do whatever else is needed to
            start the interpreter. This is called once the interpreter is loaded into
            the browser.
            */
        }

        eval(script) {
            /*
            Use the interpreter to evaluate the script.code.
            */
        }

        addFile(path, content) {
            /*
            Copy a file with the referenced path, and content, onto the local
            filesystem available to the interpreter.
            */
        }

        startREPL() {
            /*
            Start an interactive REPL session with the interpreter.
            */
        }

        stdin(input) {
            /*
            Pass the input into the interpreter's stdin.
            */
        }
    }

    // The innerHTML of the default splash screen to show while MicroPyScript is
    // starting up. Currently the page is greyed out and the words
    // "Loading MicroPyScript...".
    const defaultSplash= '<div style="position:fixed;width:100%;height:100%;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.5);z-index:9999;"><div style="position:absolute;top:50%;left:40%;color:white;">Loading MicroPyScript... 🐍</div></div>';

    /**************************************************************************
    Built-in plugins and interpreters.
    **************************************************************************/

    const pyScriptTag = function(){

        // Contains Python scripts found on the page.
        const scripts = [];

        // Contains Python scripts whose source code is available, and pending 
        // evaluation by the interpreter.
        const pendingScripts = [];

        // Eventually references the available interpreter, once ready.
        let availableInterpreter = null;

        // Eventually references the first <py-script> tag into which all
        // stdout will be piped.
        let stdoutTag = null;

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
                    logger(`Fetched script from "${script.src}". 📡`, response);
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

            Either queue it for later evaluation if the interpreter isn't ready
            yet, or dispatch the py-eval-script event to signal to the interpreter
            it should evaluate the script.
            */
            if (availableInterpreter) {
                // Interpreter is ready, so evaluate the code.
                const pyEvalScript = new CustomEvent("py-eval-script", {detail: e.detail});
                document.dispatchEvent(pyEvalScript);
            } else {
                // No interpreter, so add to pendingScripts queue, to be evaluated
                // once the interpreter is ready.
                pendingScripts.push(e.detail);
            }
        }

        function evaluateScript(e) {
            /*
            Given the interpreter is ready AND the script is loaded,
            evaluate the script with the interpreter.
            */
            logger("Evaluating code. 🤖\n" + e.detail.code);
            availableInterpreter.eval(e.detail);
        }

        function onPrint(e) {
            /*
            Handle print to stdout events.
            */
            if (stdoutTag === null) {
                const firstPyScriptTag = document.querySelector("py-script");
                const preTag = document.createElement("pre");
                firstPyScriptTag.appendChild(preTag);
                stdoutTag = document.createElement("code");
                preTag.appendChild(stdoutTag);
            }
            stdoutTag.innerText = stdoutTag.innerText + e.detail;
        }

        document.addEventListener("py-script-registered", registerScript);
        document.addEventListener("py-script-loaded", scriptLoaded);
        document.addEventListener("py-eval-script", evaluateScript);

        // The object to contain the various functions needed to handle the
        // life cycle of this plugin, returned to the MicroPyScript environment.
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
                        document.addEventListener("py-print", onPrint);
                    }
                }
                // Register it (thus extracting the code from the page).
                customElements.define('py-script', PyScript);
            },
            onInterpreterReady: function(config, interpreter) {
                availableInterpreter = interpreter;
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

    class MicroPythonInterpreter extends Interpreter {
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
            document.addEventListener('micropython-print', function(e) {
                Interpreter.print(e.data);
            }, false);
            let mp_js_startup = Module['onRuntimeInitialized'];
            Module["onRuntimeInitialized"] = async function() {
                mp_js_startup();
                mp_js_init(mp_memory);
                Interpreter.ready();
            }
        }

        eval(script) {
            mp_js_do_str(script.code);
        }

        addFile(path, content) {
            Module.FS.writeFile(path, content);
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

    class CPythonInterpreter extends Interpreter {
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

    class PyodideInterpreter extends Interpreter {
        /*
        Pyodide is a Python distribution for the browser, compiled to WASM. For
        more information, see:

        https://pyodide.org/en/stable/

        TODO: Finish this. It's a hack!
        */

        constructor() {
            super();
            // Read and emptied when Pyodide calls the stdin_func to read user
            // input. (This feels wrong, but that's just how Pyodide works.)
            this.stdInBuffer = [];
            this.repr_shorten = null;
            this.banner = null;
            this.await_fut = null;
            this.pyconsole = null;
            this.clear_console = null;
            this.term = null;
        }

        static get url() {
            return "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js";
        }

        print(output) {
            let processed_output = output.replaceAll("\n", "\n\r");
            Interpreter.print(processed_output);
        }

        start(config) {
            const stdout_func = function(output) {
                if (output === "Python initialization complete") {
                    return;
                }
                this.print(output);
            };
            const stdin_func = function() {
                return null;
            };
            async function main() {
                let pyodide = await loadPyodide({
                    stdout: stdout_func,
                    stdin: stdin_func
                });
                return pyodide;
            }
            let pyodideReadyPromise = main();
            const myself = this;
            pyodideReadyPromise.then(result => {
                myself.pyodide = result;
                Interpreter.ready()
            });
        }

        eval(script) {
            this.pyodide.runPython(script.code);
        }

        addFile(path, content) {
            this.pyodide.FS.writeFile(path, content);
        }

        startREPL(term) {
            term.prompt = () => {
                term.write("\r\n>> ");
            }
            logger("Starting Pyodide REPL. ⌨️");
            let namespace = this.pyodide.globals.get("dict")();
            this.pyodide.runPython(
              `
                import sys
                from pyodide.ffi import to_js
                from pyodide.console import PyodideConsole, repr_shorten, BANNER
                import __main__
                pyconsole = PyodideConsole(__main__.__dict__)
                import builtins
                async def await_fut(fut):
                  res = await fut
                  if res is not None:
                    builtins._ = res
                  return to_js([res], depth=1)
                def clear_console():
                  pyconsole.buffer = []
              `,
              { globals: namespace },
            );
            this.repr_shorten = namespace.get("repr_shorten");
            this.banner = namespace.get("BANNER");
            this.await_fut = namespace.get("await_fut");
            this.pyconsole = namespace.get("pyconsole");
            this.clear_console = namespace.get("clear_console");
            namespace.destroy();
            this.print(this.banner);
            this.print("\r\n>>> ")
            this.pyconsole.stdout_callback = (output) => {
                this.print(output);
            }
            this.term = term;
        }

        stdin(input) {
            // Push the input to the stdInBuffer, which is read and cleared by
            // Pyodide at some point in the future.
            if (input === "\u007F") {
                // Delete
                if (this.stdInBuffer.length > 0) {
                    this.print("\b \b");
                }
                this.stdInBuffer = this.stdInBuffer.slice(0, -1);
            } else if (input === "\r" && this.pyconsole) {
                const code = this.stdInBuffer.join("").trimEnd();
                this.stdInBuffer = [];
                let fut = this.pyconsole.push(code);
                switch (fut.syntax_check) {
                  case "syntax-error":
                    this.print(fut.formatted_error.trimEnd());
                    break;
                  case "incomplete":
                    this.print("\r\n... ");
                    break;
                  case "complete":
                    this.print("\r\n>>> ");
                    break;
                  default:
                    throw new Error(`Unexpected type ${fut.syntax_check}`);
                }
                let wrapped = this.await_fut(fut);
                wrapped.then(value => {
                  if (value !== undefined) {
                    const output = this.repr_shorten.callKwargs(value, {
                        separator: "\n<long output truncated>\n",
                        limit: 99999
                    }).trimEnd();
                    if (output) {
                        this.term.write("\x1b[2K\r");  // clear line
                        this.print(output + "\r\n>>> ");
                    }
                  }
                  if (this.pyodide.isPyProxy(value)) {
                    value.destroy();
                  }
                }).catch(e => {
                  if (e.constructor.name === "PythonError") {
                    this.term.write("\x1b[2K\r");  // clear line
                    const message = fut.formatted_error || e.message;
                    this.print(message.trimEnd().replace(/\n/g, "\r\n") + "\r\n>>> ");
                  } else {
                    throw e;
                  }
                }).finally(() => {
                  fut.destroy();
                  wrapped.destroy();
                });
            } else {
                this.stdInBuffer.push(input);
                this.print(input);
            }
        }
    }

    // Default configuration settings for MicroPyScript. These may be overridden
    // by the app.loadConfig function.
    // The "files" object should look like this:
    // "files": {
    //   "myfile.py": "https://domain.com/myfile.py",
    //   "myotherfile.txt": "otherfile.txt"
    // }
    // Key: filename on WASM filesystem.
    // Value: url to download content of file.
    const config = {
        "interpreter": "micropython",  // Numpty default.
        "splash": defaultSplash,  // loading message in grey overlay.
        "files": {}  // No files by default.
    }

    // Contains plugins to the MicroPyScript context.
    const plugins = [];

    // Details of interpreters.
    // Key: lowercase interpreter name.
    // Value: the class wrapping that version of the interpreter.
    const interpreters = {
        "micropython": MicroPythonInterpreter,
        "cpython": CPythonInterpreter,
        "pyodide": PyodideInterpreter
    }

    // Files to be loaded to the filesystem once the interpreter is loaded (but
    // perhaps not yet ready).
    const filesToLoad = [];

    // Eventually references an instance of the Interpreter class, representing the
    // started interpreter.
    let interpreter = null;

    // Flag to indicate that all the files to be copied into the filesystem
    // (defined in config) have been downloaded and copied over.
    let filesLoaded = false;

    // Flag to indicate the interpreter is ready to evaluate scripts.
    let interpreterReady = false;

    // To hold a reference to the div containing the start-up splash screen
    // displayed while MicroPyScript starts up.
    let splashElement = null;

    function loadConfig() {
        /*
        Loads configuration for running MicroPyScript from JSON contained in the
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
        Display the splash screen for when MicroPyScript is starting.
        */
        splashElement = document.createElement("div");
        splashElement.innerHTML = config.splash;
        const body = document.getElementsByTagName('body')[0];
        body.appendChild(splashElement);
    }

    function splashOff() {
        /*
        Remove the splash screen, once MicroPyScript is finished starting.
        */
        splashElement.parentNode.removeChild(splashElement);
    }

    function registerPlugin(plugin) {
        /*
        Add a plugin to the MicroPyScript context, after calling its configure
        method.
        */
        logger(`Registering plugin "${plugin.name}". 🔌`);
        plugin.configure?.(config);
        plugins.push(plugin);
        if (interpreterReady) {
            startPlugin(plugin)
            plugin.onInterpreterReady?.(config, interpreter);
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
        logger(`Starting plugin "${plugin.name}". ⚡`);
        plugin.start?.(config);
        const pyPluginStarted = new CustomEvent("py-plugin-started", {detail: { config: config, plugin: plugin}});
        document.dispatchEvent(pyPluginStarted);
    }

    function loadFiles() {
        /*
        Download and add the config.files into the local filesystem accessible
        by the interpreter.
        */
        // Holds the promises used to fetch the content of the files.
        const pendingDownloads = [];
        if (config.files) {
            // Iterate the path and associated url (pointing at the content).
            for (let path in config.files) {
                let url = config.files[path];
                logger(`Fetching file "${path}" from: ${url} 📡`);
                // Create a new promise representing the fetch call.
                const filePromise = fetch(url);
                // Ensure the response is handled in the right way.
                filePromise.then(response => {
                    if (response.ok) {
                        response.text().then(content => {
                            if (interpreterReady) {
                                // The interpreter exists, so just add the file to
                                // its filesystem.
                                const pyFileFetched = new CustomEvent("py-file-fetched", {detail: { path: path, content: content}});
                                document.dispatchEvent(pyFileFetched);
                            } else {
                                // No interpreter (yet), so push onto the
                                // filesToLoad queue so they're copied over
                                // once the interpreter becomes available.
                                filesToLoad.push({
                                    path: path,
                                    content: content
                                });
                            }
                        })
                    } else {
                        // Abort.             
                        throw `💥 Cannot load file from "${url}"`;
                    }
                });
                // Add the promise to the pendingDownloads.
                pendingDownloads.push(filePromise);
            }
        }
        // A meta-promise that resolves when all the fetch promises have
        // successfully resolved, then sets the filesLoaded flag, dispatches
        // the "py-files-loaded" event and checks if MicroPyScript has finished
        // setup.
        Promise.all(pendingDownloads).then((values) => {
            filesLoaded = true;
            if (values) {
                logger(`All files downloaded, copying to filesystem. 📥`);
            }
            const pyFilesLoaded = new CustomEvent("py-files-loaded");
            document.dispatchEvent(pyFilesLoaded);
            finished();
        })
    }

    function onFileFetched(e) {
        /*
        Save the file's content to the path on the interpreter's local filesystem.
        */
        logger(`Saving file "${e.detail.path}" to file system. 💾`);
        interpreter.addFile(e.detail.path, e.detail.content);
    }

    function loadInterpreter() {
        /*
        Given a configuration state, load the interpreter specified therein and
        dispatch a py-interpreter-loaded event when done.

        TL;DR - a new script tag with the correct src is added to the head.
        */
        if(!interpreters.hasOwnProperty(config.interpreter)) {
            throw `💥 Unknown interpreter: "${config.interpreter}" (known interpreters: ${Object.keys(interpreters)})`;
        }
        const interpreterElement = document.createElement("script");
        interpreterElement.src = interpreters[config.interpreter.toLowerCase()].url;
        interpreterElement.onload = function(e) {
            logger(`Interpreter "${config.interpreter}" loaded. 👍`);
            const pyInterpreterLoaded = new CustomEvent("py-interpreter-loaded", {detail: config.interpreter});
            document.dispatchEvent(pyInterpreterLoaded);
        };
        var head = document.getElementsByTagName('head')[0];
        logger(`Loading interpreter "${config.interpreter}". 🚀`)
        head.appendChild(interpreterElement);
    }

    function startInterpreter() {
        /*
        Configure and start the Python interpreter. Now that there is a interpreter,
        use it to add any filesToLoad to the filesystem.
        */
        interpreter = new interpreters[config.interpreter.toLowerCase()]();
        interpreter.start(config);
    }

    function interpreterStarted() {
        /*
        The interpreter is ready to go, so flip the interpreterReady flag, step
        through each registered plugin's onInterpreterReady method. Then check if
        setup is finished.
        */
        logger(`Interpreter started. 🎬`);
        interpreterReady = true;
        filesToLoad.forEach(function(file) {
            const pyFileFetched = new CustomEvent("py-file-fetched", {detail: { path: file.path, content: file.content}});
            document.dispatchEvent(pyFileFetched);
        });
        plugins.forEach(function(plugin) {
            plugin.onInterpreterReady?.(config, interpreter);
        });
        finished();
    }

    function finished() {
        /*
        If both the interpreter and filesystem are in a ready state for evaluating
        a user's code.
            - Dispatch the "py-finished-setup" event to signal everything is
              done.
        */
        if (interpreterReady && filesLoaded) {
            logger(`MicroPyScript finished setup. 🏁`);
            const pyFinishedSetup = new CustomEvent("py-finished-setup", {detail: { interpreter: interpreter}});
            document.dispatchEvent(pyFinishedSetup);
        }
    }

    // The following functions coordinate the unfolding of MicroPyScript as
    // various events are dispatched and state evolves to trigger the next
    // steps.
    //
    // These functions are defined in the order they're roughly expected to
    // be called through the life-cycle of the page, although this cannot be
    // guaranteed for some of the functions.

    function onPyConfigured(e) {
        /*
        Once MicroPyScript has loaded its configuration:
            - Register the default plugins (currently only pyScriptTag), so
              they can modify the config if required.
            - Download any files that need to be copied onto the interpreter's
              filesystem.
            - Load the Python interpreter into the browser.
            - Display the splash screen.
        */
        registerPlugin(pyScriptTag);
        loadFiles();
        loadInterpreter();
        splashOn();
    }

    function onInterpreterLoaded(e) {
        /*
        The interpreter has loaded over the network.
            - Start the interpreter in this MicroPyScript context.
            - Start the plugins to kick off plugin related aspects of the page.
        */
        startInterpreter();
        startPlugins();
    }

    function onInterpreterReady(e) {
        /*
        The interpreter is ready to evaluate scripts.
            - Kick off all the pending things needed now it's all started up.
        */
        interpreterStarted();
    }

    function onFinished(e) {
        /*
        Remove the splash screen.
        */
        splashOff();
    }

    // Finally, return a function to start MicroPyScript.
    return function() {
        document.addEventListener("py-configured", onPyConfigured);
        document.addEventListener("py-interpreter-loaded", onInterpreterLoaded);
        document.addEventListener("py-file-fetched", onFileFetched);
        document.addEventListener("py-interpreter-ready", onInterpreterReady);
        document.addEventListener("py-finished-setup", onFinished);
        // An object to represent the MicroPyScript platform in the browser. What
        // is eventually returned from the main() function.
        const pyScript = {
            get config() {
                return config;
            },
            get plugins() {
                return plugins;
            },
            get availableInterpreters() {
                return interpreters;
            },
            get interpreter() {
                return interpreter;
            },
            get isInterpreterReady() {
                return interpreterReady;
            },
            registerPlugin: function(plugin) {
                registerPlugin(plugin);
            },
            runPython: function(code) {
                if (interpreterReady) {
                    interpreter.eval(code);
                }
            },
            start: function() {
                loadConfig();
            }
        };
        return pyScript;
    }
}();


/******************************************************************************
Start MicroPyScript.
******************************************************************************/
window.pyScript = main();
if (!window.pyscriptTest) {
    window.pyScript.start();
}
