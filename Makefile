SHELL := /bin/bash

all:
	@echo "There's no default Makefile target right now. Try:"
	@echo ""
	@echo "make setup - clone the required repositories."
	@echo "make update - update the emsdk compiler."
	@echo "make mp - compile MicroPython for WASM into the mpbuild directory."
	@echo "make serve - serve the project at: http://0.0.0.0:8000/"

setup:
	git clone https://github.com/emscripten-core/emsdk.git
	git clone https://github.com/micropython/micropython.git

update:
	cd emsdk && git pull && ./emsdk install latest && ./emsdk activate latest

mp:
	rm -rf mpbuild
	$(MAKE) -C micropython/mpy-cross
	./emsdk/emsdk activate latest && source emsdk/emsdk_env.sh && $(MAKE) -C micropython/ports/webassembly
	cp -r micropython/ports/webassembly/build mpbuild

serve:
	python -m http.server
