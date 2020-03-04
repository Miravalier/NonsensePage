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
	touch keys/index.txt
	# Make root key
	openssl genrsa -out keys/ca.key.pem 4096
	chmod 400 keys/ca.key.pem
	# Make root cert
	openssl req -config local/ca.cnf \
      -key keys/ca.key.pem \
      -new -x509 -days 7300 -sha256 -extensions v3_ca \
      -out keys/ca.cert.pem < local/ca.input
	chmod 444 keys/ca.cert.pem
	# Create dnd.local key
	openssl genrsa -out keys/dnd.key.pem 2048
	# Create dnd.local csr
	openssl req -new -key keys/dnd.key.pem -out keys/dnd.csr.pem < local/dnd.input
	# Create dnd.local cert
	openssl x509 -req -in keys/dnd.csr.pem -CA keys/ca.cert.pem -CAkey keys/ca.key.pem \
	-CAcreateserial -out keys/dnd.cert.pem -days 1825 -sha256 -extfile local/dnd.ext
	# Prepare files for use
	cp keys/dnd.cert.pem keys/fullchain.pem
	cp keys/dnd.key.pem keys/privkey.pem
	# Update nginx site
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
