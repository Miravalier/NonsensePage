.DEFAULT_GOAL = all

# Variables
DIRECTORIES := $(shell find resources -type d)
DIRECTORIES += $(shell find modules -type d)
RESOURCES := $(shell find resources -type f)
RESOURCES += $(shell find modules -type f)
RESOURCES += dnd.html dnd.js dnd.css
WEB_ROOT := /var/www/nonsense
WSS_ROOT := /var/wss
SYSTEMD := /etc/systemd/system

# Generated Rules
${WEB_ROOT}/%: %
	@cp $< $<.conf
	@./configurer.py $<.conf $(VERBOSITY)
	sudo cp $<.conf $@
	@rm $<.conf

ALL_TARGETS += ${WSS_ROOT}/dnd.py ${SYSTEMD}/dnd.wss.service
define resource_template =
 ${WEB_ROOT}/$(1): $(1)
 ALL_TARGETS += ${WEB_ROOT}/$(1)
endef

$(foreach resource,$(RESOURCES),$(eval $(call resource_template,$(resource))))

directories:
	@sudo mkdir -p ${WEB_ROOT}/content $(addprefix ${WEB_ROOT}/,${DIRECTORIES})

# Constant Rules
${WSS_ROOT}/dnd.py: dnd.py ${SYSTEMD}/dnd.wss.service
	sudo cp $< $@
	sudo service dnd.wss restart

${SYSTEMD}/dnd.wss.service: dnd.wss.service
	sudo cp $< $@
	sudo systemctl daemon-reload

# Conventional Targets
all: directories $(ALL_TARGETS)

verbose: all
verbose: VERBOSITY := -v

.PHONY: all verbose directories
