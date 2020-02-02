.DEFAULT_GOAL = install

dnd.html: dnd.html.template
	cp dnd.html.template dnd.html
	./configurer.py dnd.html $(VERBOSITY)

install: dnd.html
	sudo ./installer.py $(VERBOSITY)

verbose: VERBOSITY := -v
verbose: install

.PHONY: install verbose
