/*
It has been a while since I've used Jasmine, so some of these tests are likely
unidiomatic... but it's a start.

TODO: Complete coverage of test suite...
TODO: Read the damn docs to figure out how to do some of the (async-ish) tests
I need to do.
*/

describe("In the PyScript project,", function() {

  beforeEach(function() {
    pyscript = main();
  });

  it("main() should return an object representing PyScript 🐍", function() {
    expect(pyscript).toBeDefined();
  });

  describe("With the PyScript object, returned by main,", function() {
    var pyConfigElement = null;

    beforeEach(function() {
        pyConfigElement = document.createElement("py-config");
        pyConfigElement.innerText = '{"runtime": "micropython","mp_memory":65536}';
        const body = document.getElementsByTagName('body')[0];
        body.appendChild(pyConfigElement);
    });

    afterEach(function(){
        pyConfigElement.remove();
        form = null;
    });

    it("loadConfig should put JSON from the <py-config> tag into config", function() {
        let result = undefined;
        function checkEvent(e) {
            result = e.detail;
        };
        document.addEventListener("py-configured", checkEvent);
        pyscript.start();
        expect(result.runtime).toEqual("micropython");
        expect(result.mp_memory).toEqual(65536);
    });

    it("loadConfig should dispatch the py-configured event", function() {
        let result = undefined;
        function checkEvent(e) {
            result = e.detail;
        };
        document.addEventListener("py-configured", checkEvent);
        pyscript.start();
        expect(result).toBeDefined()
    });

    it("splashOn should display the 'PyScript loading...' splash screen, splashOff should remove it", function() {
        pyscript.splashOn();
        let body = document.getElementsByTagName('body')[0];
        expect(body.innerText).toContain('Loading PyScript...');
        pyscript.splashOff();
        body = document.getElementsByTagName('body')[0];
        expect(body.innerText).not.toContain('Loading PyScript...');
    });
    it("registerPlugin should configure the passed-in plugins, startPlugins should start them", function() {
        let configureFlag = false;
        let startFlag = false;
        const TestPlugin = {
            configure: function(config) {
                configureFlag = true;
            },
            start: function(config) {
                startFlag = true;
            }
        }
        pyscript.registerPlugin(TestPlugin);
        expect(configureFlag).toEqual(true);
        pyscript.startPlugins();
        expect(startFlag).toEqual(true);
    });
  });
});
