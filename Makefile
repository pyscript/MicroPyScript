SHELL := /bin/bash

all:
	@echo "\nThere's no default Makefil target right now. Try\n\n"
	@echo "make setup - clone the required repositories."
	@echo "make update - update the emsdk compiler."
	@echo "make refresh - re-compile MicroPython for WASM into build."

setup:
	git clone https://github.com/emscripten-core/emsdk.git
	git clone https://github.com/micropython/micropython.git
	git clone  https://github.com/python/cpython.git

update:
	cd emsdk && git pull && ./emsdk install latest && ./emsdk activate latest

mp:
	rm -rf mpbuild
	$(MAKE) -C micropython/mpy-cross
	./emsdk/emsdk activate latest && source emsdk/emsdk_env.sh && $(MAKE) -C micropython/ports/webassembly
	cp -r micropython/ports/webassembly/build mpbuild

py:
	rm -rf pybuild
	./cpython/Tools/wasm/wasm_build.py build
	./emsdk/emsdk activate latest && source emsdk/emsdk_env.sh && ./cpython/Tools/wasm/wasm_build.py emscripten-browser
	cp -r cpython/builddir/emscripten-browser pybuild

serve:
	python -m http.server
