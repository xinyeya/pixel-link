/* Pixel Link libretro host. GPL-2.0-or-later, distributed with FCEUmm. */
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include "libretro.h"
static uint32_t video[256*240];
static int16_t audio[8192];
static unsigned audio_count;
static uint8_t pads[2];
static bool loaded;
static unsigned format = RETRO_PIXEL_FORMAT_XRGB8888;
static double fps=60;
static const char *keys[160], *values[160];
static unsigned options;
static void option(const char *key,const char *value){if(options<160){keys[options]=key;values[options++]=value;}}
static bool environment(unsigned cmd, void *data){
 switch(cmd){
 case RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION: *(unsigned*)data=2;return true;
 case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_V2: {
  const struct retro_core_options_v2 *o=data;options=0;
  for(const struct retro_core_option_v2_definition *d=o->definitions;d->key;d++)option(d->key,d->default_value);return true;}
 case RETRO_ENVIRONMENT_GET_VARIABLE:{struct retro_variable *v=data;
  if(!strcmp(v->key,"fceumm_overscan")){v->value="disabled";return true;}
  if(!strcmp(v->key,"fceumm_ramstate")){v->value="fill $ff";return true;}
  if(!strcmp(v->key,"fceumm_sndrate_hint")){v->value="48KHz";return true;}
  for(unsigned i=0;i<options;i++)if(!strcmp(keys[i],v->key)){v->value=values[i];return true;}return false;}
 case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE: *(bool*)data=false;return true;
 case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
 case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char**)data="/";return true;
 case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: format=*(unsigned*)data;return format==RETRO_PIXEL_FORMAT_XRGB8888;
 case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool*)data=true;return true;
 case RETRO_ENVIRONMENT_SET_GEOMETRY:return true;
 default:return false;
 }
}
static void picture(const void *data,unsigned w,unsigned h,size_t pitch){
 if(!data)return;
 // Full NES viewport; no frontend-specific overscan cropping.
 for(unsigned y=0;y<240;y++)for(unsigned x=0;x<256;x++){
  uint32_t c=*(const uint32_t*)((const uint8_t*)data+(y*h/240)*pitch+(x*w/256)*4);
  video[y*256+x]=0xff000000|((c&255)<<16)|(c&0xff00)|((c>>16)&255);
 }
}
static void sample(int16_t l,int16_t r){if(audio_count+2<=8192){audio[audio_count++]=l;audio[audio_count++]=r;}}
static size_t batch(const int16_t *data,size_t frames){for(size_t i=0;i<frames;i++)sample(data[i*2],data[i*2+1]);return frames;}
static void poll(void){}
static int16_t input(unsigned port,unsigned device,unsigned index,unsigned id){
 // Application order: A,B,Select,Start,Up,Down,Left,Right.
 static const unsigned ids[8]={RETRO_DEVICE_ID_JOYPAD_A,RETRO_DEVICE_ID_JOYPAD_B,RETRO_DEVICE_ID_JOYPAD_SELECT,RETRO_DEVICE_ID_JOYPAD_START,RETRO_DEVICE_ID_JOYPAD_UP,RETRO_DEVICE_ID_JOYPAD_DOWN,RETRO_DEVICE_ID_JOYPAD_LEFT,RETRO_DEVICE_ID_JOYPAD_RIGHT};
 if(port>=2||device!=RETRO_DEVICE_JOYPAD||index)return 0;
 for(unsigned i=0;i<8;i++)if(id==ids[i])return (pads[port]>>i)&1;return 0;
}
int pl_load(const uint8_t *bytes,unsigned size){
 if(loaded){retro_unload_game();retro_deinit();loaded=false;}
 FILE *f=fopen("/game.nes","wb");if(!f)return 0;
 size_t written=fwrite(bytes,1,size,f);fclose(f);if(written!=size)return 0;
 memset(video,0,sizeof(video));memset(pads,0,sizeof(pads));audio_count=0;
 retro_set_environment(environment);retro_set_video_refresh(picture);retro_set_audio_sample(sample);retro_set_audio_sample_batch(batch);retro_set_input_poll(poll);retro_set_input_state(input);retro_init();
 struct retro_game_info game={"/game.nes",NULL,0,NULL};
 loaded=retro_load_game(&game);if(!loaded){retro_deinit();return 0;}
 retro_set_controller_port_device(0,RETRO_DEVICE_JOYPAD);retro_set_controller_port_device(1,RETRO_DEVICE_JOYPAD);
 struct retro_system_av_info av;retro_get_system_av_info(&av);fps=av.timing.fps;return 1;
}
void pl_run(unsigned a,unsigned b){pads[0]=a;pads[1]=b;audio_count=0;if(loaded)retro_run();}
uint32_t *pl_video(void){return video;}
int16_t *pl_audio(void){return audio;}
unsigned pl_audio_count(void){return audio_count;}
double pl_fps(void){return fps;}
unsigned pl_state_size(void){return loaded?retro_serialize_size():0;}
int pl_save(void *p,unsigned size){return retro_serialize(p,size);}
int pl_restore(const void *p,unsigned size){return retro_unserialize(p,size);}
uint8_t *pl_ram(void){return retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);}
