# MicroPyScript 🔬 🐍

A small, simple kernel of PyScript, made for testing purposes.

This is the way:

* Obvious code.
* Simple is good.
* No dependencies.
* Vanilla JavaScript.
* Pluggable.
* Comments.
* Tests.
* Build for change.

This is a solid foundation for lightweight testing of Python runtimes that
target WASM. Inspired by code in the "real" PyTest website and our plans for
plugins and simple event based coordination.

Complexity, edge cases and customization is (hopefully) confined to plugins and
bespoke runtimes.

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

Then point your browser to http://0.0.0.0:8000/ to see a "Hello World" from
MicroPython.

### What's in the files?

* **Makefile** - common tasks scripted into convenient targets. See above.
* **hello.py** - a simple "hello world" Python script for PyScript to run.
* **index.html** - a small web page that uses PyScript.
* **pyscript.js** - the simple, single file implementation of PyScript.

To change the configuration of PyScript take a look at the JSON object
defined in the `<py-config>` tag in `index.html`. Currently valid runtimes are
`micropython` or `pyodide`.

## Running the tests

For the sake of simplicity (and familiarity) we use the
[Jasmine test framework](https://jasmine.github.io/index.html) to exercise the
JavaScript aspects of our code.

Ensure the project is being served (`make serve`) and in a different shell, in
the root of this project, type `make test`. Your default browser should open
and run the Jasmine based test suite.

## How it works

There are copious comments in the `pyscript.js` file. My intention is for
simplicity, lack of onerous dependencies (bye-bye `npm`), and
understandability. This code is working if it's easy to understand what's going
on. To this end, it's laid out in a "literate" manner, so the code "tells the
story" of this implementation of PyScript by reading it from top to bottom.

In terms of architecture, this version of PyScript aims to provide a very
small core that coordinates features and capabilities provided by plugins. This
coordination is almost always handled by dispatching custom events to the
`document`. Everything is losely coupled, and state is contained within the
function/closure that is the `main` function (called right at the end). The
`main` function returns an object containing methods to interact with
PyScript (useful for testing purposes).

### Base classes and constants

The `Plugin` class is based upon Antonio's suggestion
[found here](https://github.com/pyscript/pyscript/issues/763#issuecomment-1245086859),
and should be relatively self explanatory.

The only difference between this implementation and Antonio's is that his
version has `before_evalute` and `after_evaluate` methods. These are redundant
in this version of PyScript since it's not known ahead of time when either the
scripts nor runtime will be ready for evaluation. As far as I can tell, I think
these functions are supposed to be run either before or after ALL the scripts
are evaluated (at once) rather than before or after each individual script.

This probably needs more thought/discussion.

The `Runtime` class abstracts away all the implementation details of the
various Python runtimes we might use. To see a complete implementation see the
`MicroPythonRuntime` class that inherits from `Runtime`. There is also an
incomplete `PyodideRuntime` class so I was able to compare and contrast the
differences between implementations and arrive at a general abstraction (still
very much a work in progress). Again, the comments in the code should explain
what's going on in terms of the life-cycle and capabilities of a "runtime".

Finally, the `defaultSplash` is the `innerHtml` added to / removed from the DOM
to indicate PyScript is starting up. It currently overlays an opaque DIV with
the centred words "Loading PyScript...". This can be overridden by adding a
`splash` entry to the JSON configuration in the `<py-config>` tag.

### Built-in plugins and runtimes

Currently, only one plugin is currently defined to handle the `<py-script>`
tag: `PyScriptTag`. This is a rather simple plugin which ultimately dispatches
the `py-script-registered` custom event (containing relevant metadata) to
indicate Python source code has been found in the page (more on this later).

The afore mentioned `MicroPythonRuntime`, `CPythonRuntime` and `PyodideRuntime`
all, to a greater or lesser extent, define a uniform shim around their
respective runtimes. The MicroPython one is most complete, but still needs work
as I make changes to how MicroPython itself exposes `stdout`, `stderr` and
consumes `stdin`.

### The core PyScript app definition

This is simply a `main` function / closure, in which is stored lots of private
state and definitions that we don't want bleeding out into the
external-to-PyScript context.

The function starts with a definition of a very simple logger that pre-pends
"🐍" to all PyScript related `console.log` messages, for ease of reading.

Next comes some declarations and initial states for various objects used to
store state and coordinate the activity of PyScript. Because they only exist
within the context of the closure, they're effectively private to the outside
world. The comments and their names should indicate their function and how they
relate to each other.

Next comes the definition of an `app` object. This is what is eventually
returned by the `main` function (for testing purposes). The object contains
various functions that manage the state and coordinate the activity of
PyScript. Again, the function names and their associated commentary should
describe what the intention is for each one. To be honest, they're all really
very serious, with the most complicated being due to conditional paths
depending on the state of the runtime.

As each function finishes its task, if required, it signals a change in state
through dispatching custom events via the `document` object.

Underneath the `app` object are defined some event handler functions that
"plumb together" the various capabilities defined in the `app`'s functions. How
these relate to each other is described below.

Finally, depending on a `window.pyscriptTest` flag (set to `true` in a testing
context), the event handlers are registered against the relevant events and
the `loadConfig` function is called to boot up the whole thing.

The story of the PyScript app, roughly unfolds like this:

1. The `main` function is called, with the resulting `app` object bound to
   `window.pyscriptApp`.
2. Calling `main` also causes PyScript to load any user configuration
   (currently, for simplicity's sake, expressed as JSON). When this is finished
   the `py-configured` event is fired.
3. Next, built-in plugins are registered, after which the (internal) `config`
   object is frozen (i.e. can't change).
4. The default `<py-script>` tag dispatches a `py-script-registered` event
   when a Python script is found.
5. If the Python script's code is inline (i.e. a part of the document already)
   then a `py-script-loaded` event is dispatched for that script. However, if
   the Python script is referenced via a `src` URL, then PyScript fetches the
   remote asset and only dispatches `py-script-loaded` for the script when the
   code is retrieved.
6. If the runtime is ready, each newly registered script is immediately
   evaluated by dispatching the `py-eval-script`. Otherwise, the scripts are
   added to a `pendingScripts` array for later processing when the runtime has
   finally started.
7. In the meantime, the runtime specified in the `config` is loaded into the
   browser by injecting a `script` tag into the `head` of the document. When
   this script has finished loading a `py-runtime-loaded` event is dispatched.
8. The `Runtime` subclass instance, representing the loaded runtime, then has
   its `start` method called. Upon completion of starting up the runtime, the
   `py-runtime-ready` event is dispatched and the `runtimeReady` flag is set
   to true.
9. At this point, any scripts in the `pendingScripts` array are evaluated in
   order, after which the array is cleared and discarded.

That's it. You can see this unfolding in the image below, taken from the
console logs for the example `hello.py` based application found in
`index.html`.

![PyScript logs](pyscript-logs.png?raw=true "PyScript logs")

## The future

Who knows..? But this is a good scaffold for testing different Python runtimes.

Next steps:

* More comprehensive tests.
* `CPythonRuntime` fully implemented.
* `PyodideRuntime` finished.
* `MicroPythonRuntime` refactored after making MicroPython play nicer with
  `stdout` and `stderr`.
* A plugin for a `<py-repl>` tag (the foundations are in place).
* A uniform way to `pip install` packages in each runtime.
* A uniform JavaScript gateway from within each runtime.
* A uniform `navigator` object through which to access the DOM from within each
  runtime.
* Running in web-workers (and associated message passing work), for each
  runtime.

That's it..! ;-)
