.DEFAULT_GOAL = unknown

# Variables
SOURCEDIR := $(shell pwd)
WEB_ROOT := /var/www/nonsense
WSS_ROOT := /var/wss
SYSTEMD := /etc/systemd/system
CPP := /usr/bin/cpp

DIRECTORIES += $(shell find resources -type d)
DIRECTORIES += $(shell find modules -type d)
RESOURCES += $(shell find resources -type f)
RESOURCES += $(shell find modules -type f)
RESOURCES += dnd.html dnd.js dnd.css login.html login.css

# Generated Rules
${WEB_ROOT}/%: %
	@if [ -n "$(findstring .js,$<)$(findstring .html,$<)" ]; then \
		echo "Configuring $<"; \
		./configurer.py $< $(VERBOSITY) -b $(BUILDTYPE) -s $(SOURCEDIR) \
		-f $(FULLCHAIN) -k $(KEYFILE) -o resource.configured; \
		$(CPP) -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs \
			-fdollars-in-identifiers -C -DBUILDTYPE_$(BUILDTYPE)\
			resource.configured -o resource.configured.cpp; \
		sudo cp resource.configured.cpp $@; \
		rm -f resource.configured resource.configured.cpp; \
	else \
		sudo cp $< $@; \
	fi
	@echo "Installing $< to $@"

FILE_TARGETS += ${WSS_ROOT}/dnd.py ${SYSTEMD}/dnd.wss.service
define resource_template =
 ${WEB_ROOT}/$(1): $(1)
 FILE_TARGETS += ${WEB_ROOT}/$(1)
endef

define directory_template =
 DIRECTORY_TARGETS += ${WEB_ROOT}/$(1)
 ${WEB_ROOT}/$(1): $(1)
	sudo mkdir -p ${WEB_ROOT}/content ${WEB_ROOT}/$(1)
	@sudo touch ${WEB_ROOT}/$(1)
endef

$(foreach resource,$(RESOURCES),$(eval $(call resource_template,$(resource))))

$(foreach directory,$(DIRECTORIES),$(eval $(call directory_template,$(directory))))

# Constant Rules
${WSS_ROOT}/dnd.py: dnd.py ${SYSTEMD}/dnd.wss.service
	@sudo mkdir -p ${WSS_ROOT}
	./configurer.py $< $(VERBOSITY) -b $(BUILDTYPE) -s $(SOURCEDIR) \
	-f $(FULLCHAIN) -k $(KEYFILE) -o $<.configured
	sudo cp $<.configured $@
	sudo service dnd.wss restart
	@sudo rm -f $<.configured

${SYSTEMD}/dnd.wss.service: dnd.wss.service
	sudo cp $< $@
	sudo systemctl daemon-reload

keys: Makefile
	rm -rf keys
	mkdir -p keys
	mkdir -p keys/certs keys/crl keys/newcerts keys/private
	chmod 700 keys/private
	touch keys/index.txt
	echo 1000 > keys/serial
	# Make root key
	openssl genrsa -out keys/private/ca.key.pem 4096
	chmod 400 keys/private/ca.key.pem
	# Make root cert
	openssl req -config local/openssl.cnf \
      -key keys/private/ca.key.pem \
      -new -x509 -days 7300 -sha256 -extensions v3_ca \
      -out keys/certs/ca.cert.pem < local/ca_parameters.txt
	chmod 444 keys/certs/ca.cert.pem
	# Old self signed cert
	openssl req -x509 -newkey rsa:4096 -keyout keys/privkey.pem -out keys/fullchain.pem \
	-days 365 -nodes < local/cert_parameters.txt
	# Return to working directory
	sudo ./configurer.py local/dnd.local $(VERBOSITY) -b $(BUILDTYPE) -s $(SOURCEDIR) \
	-f $(FULLCHAIN) -k $(KEYFILE) -o /etc/nginx/sites-enabled/dnd.local
	sudo service nginx restart

# Conventional Targets
all: $(DIRECTORY_TARGETS) $(FILE_TARGETS)

release: all
release: BUILDTYPE := RELEASE
release: FULLCHAIN := /etc/letsencrypt/live/nonsense.page/fullchain.pem
release: KEYFILE := /etc/letsencrypt/live/nonsense.page/privkey.pem

local: keys all
local: BUILDTYPE := LOCAL
local: FULLCHAIN := $(shell pwd)/keys/fullchain.pem
local: KEYFILE := $(shell pwd)/keys/privkey.pem

unknown:
	@echo error: specify \'make release\' or \'make local\'

verbose: local
verbose: VERBOSITY += -v

.PHONY: all verbose release local unknown
