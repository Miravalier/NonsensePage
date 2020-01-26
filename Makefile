all: install

configure:
	cp dnd.html.template dnd.html
	./configurer.py dnd.html

install: configure
	sudo ./installer.py

verbose: configure
	sudo ./installer.py -v

.PHONY: all install verbose configure
