all: install

install:
	sudo ./installer.py

verbose:
	sudo ./installer.py -v

.PHONY: all install
