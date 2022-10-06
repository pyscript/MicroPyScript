# PyScript Lite

A small, simple kernel of PyScript, made for testing purposes.

This is the way:

* Obvious code.
* Simple is good.
* Build for change.
* No dependencies.
* Pluggable.

This is a solid foundation for lightweight testing of Python runtimes that
target WASM. Inspired by code in the "real" PyTest website.

Complexity, edge cases, customization and mess is confined to plugins.

That is all.

## Developer Setup

In order to compile MicroPython you'll need to ensure you have the expected
compiler tools described here:

https://docs.micropython.org/en/latest/develop/gettingstarted.html

Otherwise, common tasks are scripted by a Makefile (tested on Linux):

```
$ make
There's no default Makefile target right now. Try:

make setup - clone the required repositories.
make update - update the emsdk compiler.
make mp - compile MicroPython for WASM into the mpbuild directory.
make serve - serve the project at: http://0.0.0.0:8000/
```
