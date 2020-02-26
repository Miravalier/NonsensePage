.DEFAULT_GOAL = all

# Variables
WEB_ROOT := /var/www/nonsense
WSS_ROOT := /var/wss
SYSTEMD := /etc/systemd/system

DIRECTORIES += $(shell find resources -type d)
DIRECTORIES += $(shell find modules -type d)
RESOURCES += $(shell find resources -type f)
RESOURCES += $(shell find modules -type f)
RESOURCES += dnd.html dnd.js dnd.css login.html login.css

# Generated Rules
${WEB_ROOT}/%: %
	@echo "sudo cp $< $@"
	@./configurer.py $< $(VERBOSITY) -o resource.configured
	@sudo cp resource.configured $@
	@rm resource.configured

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
	sudo cp $< $@
	sudo service dnd.wss restart

${SYSTEMD}/dnd.wss.service: dnd.wss.service
	sudo cp $< $@
	sudo systemctl daemon-reload

# Conventional Targets
all: $(DIRECTORY_TARGETS) $(FILE_TARGETS)

verbose: all
verbose: VERBOSITY := -v

.PHONY: all verbose
