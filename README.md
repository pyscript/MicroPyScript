# MicroPyScript 🔬 🐍

A small, simple kernel of PyScript, made for testing purposes in the spirit of
a [code spike](https://en.wikipedia.org/wiki/Spike_(software_development)).

This is the way:

* Obvious code.
* Simple is good.
* No dependencies.
* Vanilla JavaScript.
* Pluggable.
* Comments.
* (Some) tests.
* Build for change.

This is a foundation for lightweight testing of Python interpreters that
target WASM. Inspired by code in the "real" PyScript website and our plans for
plugins and simple event based coordination.

Complexity, edge cases and customization is (hopefully) confined to plugins and
bespoke interpreters.

That is all.

## Developer setup

In order to compile MicroPython you'll need to ensure you have the expected
dev tools described here:

https://docs.micropython.org/en/latest/develop/gettingstarted.html

Otherwise, common tasks are scripted by a Makefile (tested on Linux):

```
$ make
There's no default Makefile target right now. Try:

make setup - clone the required repositories.
make update - update the emsdk compiler.
make mp - compile MicroPython for WASM into the mpbuild directory.
make serve - serve the project at: http://0.0.0.0:8000/
make test - while serving the app, run the test suite in browser.
```

To get a working development environment with MicroPython run:

```bash
$ make setup
$ make update
$ make mp
```

To check things are working:

```bash
$ make serve
```

Then point your browser to http://0.0.0.0:8000/ to see the first page of an
interactive technical report about using MicroPython. You should be able to
change the interpreter from `micropython` to `pyodide` and things should just
work as before, but with a different interpreter at the bottom of the PyScript
stack.

## Running the tests

**TESTS ARE CURRENTLY BROKEN**

For the sake of simplicity (and familiarity) we use the
[Jasmine test framework](https://jasmine.github.io/index.html) to exercise the
JavaScript aspects of our code.

Ensure the project is being served (`make serve`) and in a different shell, in
the root of this project, type `make test`. Your default browser should open
and run the Jasmine based test suite.

## How it works

The PyScript core only loads configuration, starts the Python interpreter, 
allows the registration of plugins and adds files to the interpreter's
filesystem. All other logic, capabilities and features are contained in the
plugins.

Currently, only two plugins are provided:

* One built into PyScript that implements the core `<py-script>` tag.
* The other (in `customtags.js`) implements the `<py-repl>` tag to demonstrate
  a "third party" plugin.

The story of PyScript's execution is roughly as follows:

1. Configuration is loaded from the `<py-config>` tag. Once complete the
   `py-configured` event is dispatched, containing the `config` object based
   upon default values overridden by the content of the `<py-config>` tag.
2. When the `py-configured` event is dispatched three things happen:
   * The interpreter is loaded via injecting a `<script>` tag that references the
     interpreter's URL. Once loaded the `py-interpreter-loaded` event is dispatched.
   * Plugins are registered and have their `configure` function called. For each
     plugin registered a `py-plugin-registered` event is dispatched, containing
     the (potentially changed) `config`, and a reference to the newly registered
     plugin.
   * The content of the files to be added to the interpreter's filesystem are
     fetched. Once downloaded each file causes a `py-file-fetched` event to be
     dispatched with the path and content of the file attached to it.
3. When `py-interpreter-loaded` is dispatched two things happen:
   * The interpreter is instantiated / started. Once complete the `py-interpreter-ready`
     event is dispatched.
   * All registered plugins have their `start` function called and a
     `py-plugin-started` event is dispatched for each plugin.
4. When the `py-interpreter-ready` event is dispatched all plugins have their
   `onInterpreterReady` function called with the `config` and `interpreter`
   objects. At this point all files are copied onto the interpreter's
   filesystem. When all the files are copied the `py-files-loaded` event is
   dispatched.
5. When both the interpreter and filesystem are finished setting up and in a
   ready state, the `py-finished-setup` event is dispatched to signal PyScript
   is ready to evaluate user's code.
6. Any plugins registered after the interpreter is ready immediately have their
   `configure`, `start` and `onInterpreterReady` functions called, with the
   `py-plugin-registered` and `py-plugin-started` events being dispatched.

That's it!

When `pyscript.js` is run, it creates a `window.PyScript` object that contains
read-only references to the `config`, registered `plugins`,
`availableInterpreters`, the `interpreter` used on the page, a
n `isInterpreterReady` flag, a `registerPlugin` function (see below) and a
`runPython(code)` function that takes a string of Python.

There are copious comments in the `pyscript.js` file. My intention is for
simplicity, lack of onerous dependencies (bye-bye `npm`), and
understandability. This code is good if it's easy to understand what's going
on. To this end, it's laid out in a "literate" manner, so the code "tells the
story" of this implementation of PyScript by reading it from top to bottom.

## Plugins

Plugins are inspired by Antonio's suggestion
[found here](https://github.com/pyscript/pyscript/issues/763#issuecomment-1245086859),
and should be relatively self explanatory.

Since simplicity is the focus, plugins are simply JavaScript objects.

Such objects are expected they have a `name` attribute referencing a string
naming the plugin (useful for logging purposes). Plugins should also provide
one or more of the following functions attached to them, called in the
following order (as the lifecycle of the plugin):

* `configure(config)` - Gives the plugin early access to the `config` object.
  Potentially, the plugin can modify it, and modifications will be visible to
  later steps and other plugins. Plugins must only modify the config at this
  point in their life-cycle. Examples of things which plugins might want to do
  at this point:
  - Early sanity check about their own options.
  - Rename/remap some options.
  - Add new packages to install.
  - Modify options for other plugins (e.g. a debugger plugin might set the
    option `show_terminal`).
* `start(config)` - The main entry point for plugins. At this point, config
  should not be modified by the plugin. Example use cases:
  - Define custom HTML elements.
  - Start fetching external resources.
* `onInterpreterReady(config, interpreter)` - Called once the interpreter is
  ready to evaluate Python code. Example use cases:
  - `pip install` packages.
  - Import/initialize Python plugins.

The following events, dispatched by PyScript itself, are related to plugins:

* `py-plugin-registered` - Dispatched when a plugin is registered (and the
  event contains a reference to the newly registered plugin). This happens
  immediately after the plugin's `configure` function is called.
* `py-plugin-started` - Dispatched immediately after a plugin's `start`
  function is called. The event contains a reference to the started plugin.
* `py-interpreter-ready` - causes each plugin's `onInterpreterReady` function
  to be called.

If a plugin is registered *after* the interpreter is ready, all three functions
are immediately called in the expected sequence, one after the other.

The recommended way to create and register plugins is:

```JavaScript
const myPlugin = function(e) {
    /*
    Private and internal logic, event handlers and event dispatch can happen
    within the closure defined by this function.

    e.g.

    const FOO = "bar";

    function foo() {
        const myEvent = new CustomEvent("my-event", {detail: {"foo": FOO}});
        document.dispatchEvent(myEvent);
    }

    function onFoo(e) {
        console.log(e.detail);
    }

    document.addEventListener("my-event", onFoo);

    ...
    */

    const plugin = {
        name: "my-plugin",
        configure: function(config) {
            // ...
        },
        start: function(config) {
            // ...
            foo();
        },
        onInterpreterReady: function(config, interpreter) {
            // ...
        }
    };
    window.pyScript.registerPlugin(plugin);
}();

document.addEventListener("py-configured", myPlugin);
```

Then in your HTML file:

```html
<script src="myplugin.js"></script>
<script src="pyscript.js" type="module"></script>
```

## Interpreters 

The `Interpreter` class abstracts away all the implementation details of the
various Python interpreters we might use.

To see a complete implementation see the `MicroPythonInterpreter` class that
inherits from `Interpreter`. There is also an incomplete `PyodideInterpreter`
class so I was able to compare and contrast the differences between
implementations and arrive at a general abstraction (still very much a work in
progress). Comments in the code should explain what's going on in terms of the
life-cycle and capabilities of a "interpreter".

The afore mentioned `MicroPythonInterpreter`, `CPythonInterpreter` and
`PyodideInterpreter` all, to a greater or lesser extent, define a uniform shim
around their respective interpreter. The MicroPython one is most complete, but
still needs work as I make changes to how MicroPython itself exposes `stdout`,
`stderr` and consumes `stdin`.

## The future

Who knows..? But this is a good scaffold for testing different Python
interpreters.

Next steps:

* More comprehensive tests.
* `CPythonInterpreter` fully implemented.
* `PyodideInterpreter` finished.
* `MicroPythonInterpreter` refactored after making MicroPython play nicer with
  `stdout` and `stderr`.
* A uniform way to `pip install` packages in each interpreter.
* A uniform JavaScript gateway from within each interpreter.
* A uniform `navigator` object through which to access the DOM from within each
  interpreter.
* Running in web-workers (and associated message passing work), for each
  interpreter.

That's it..! ;-)
