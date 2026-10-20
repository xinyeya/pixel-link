# Requires the pinned upstream source in CORE_SOURCE and Emscripten 4.0.20.
CORE_SOURCE ?= /tmp/pixel-link-fceumm
CORE_DIR := $(CORE_SOURCE)/src
WANT_32BPP := 1
STATIC_LINKING := 0
include $(CORE_SOURCE)/Makefile.common
OUT ?= ../../public/cores/fceumm.js
CFLAGS := -O3 -DNDEBUG -DHAVE_STDINT_H -DHAVE_INTTYPES_H $(COREDEFINES) $(INCFLAGS)
OBJECTS := $(SOURCES_C:.c=.pl.o) bridge.pl.o
all: $(OUT)
%.pl.o: %.c
	emcc $(CFLAGS) -c $< -o $@
$(OUT): $(OBJECTS) Makefile
	emcc $(OBJECTS) -O3 -o $@ -lm -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sFILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAP16,HEAPU32 -sEXPORTED_FUNCTIONS='["_malloc","_free","_pl_load","_pl_run","_pl_video","_pl_audio","_pl_audio_count","_pl_fps","_pl_state_size","_pl_save","_pl_restore","_pl_ram"]'
