.PHONY: test test-ts test-nvim build

build:
	cd ts && npm run build

test-ts: build
	cd ts && node --test test/*.test.js

test-nvim: build
	@bash test/nvim/run_tests.sh

test: test-ts test-nvim
