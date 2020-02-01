.DEFAULT_GOAL = install

configure:
	cp dnd.html.template dnd.html
	./configurer.py dnd.html $(VERBOSITY)

install: configure
	sudo ./installer.py $(VERBOSITY)

verbose: VERBOSITY := -v
verbose: install

.PHONY: configure install verbose
