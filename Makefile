SHELL := /bin/bash

all:
	@echo "There's no default Makefile target right now. Try:"
	@echo ""
	@echo "make setup - clone the required repositories."
	@echo "make update - update the emsdk compiler."
	@echo "make mp - compile MicroPython for WASM into the mpbuild directory."
	@echo "make serve - serve the project at: http://0.0.0.0:8000/"
	@echo "make test - while serving the app, run the test suite in browser."

setup:
	git clone https://github.com/emscripten-core/emsdk.git
	git clone https://github.com/micropython/micropython.git
	git clone https://github.com/v923z/micropython-ulab.git

update:
	cd emsdk && git pull && ./emsdk install latest && ./emsdk activate latest

mp:
	rm -rf mpbuild
	rm -rf micropython/ports/webassembly/build
	$(MAKE) -C micropython/mpy-cross
	./emsdk/emsdk activate latest && source emsdk/emsdk_env.sh && $(MAKE) -C micropython/ports/webassembly USER_C_MODULES=../../../micropython-ulab/
	cp -r micropython/ports/webassembly/build mpbuild

serve:
	python -m http.server

test:
	python -m webbrowser "http://0.0.0.0:8000/SpecRunner.html"

minify:
	uglifyjs pyscript.js --compress --mangle -o pyscript.min.js
