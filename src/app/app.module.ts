import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { HttpClientJsonpModule, HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';

@NgModule({
	declarations: [
		AppComponent
	  ],
	  imports: [
		BrowserModule,
		HttpClientModule,
		HttpClientJsonpModule,
		LeafletModule,
	  ],
	providers: [],
	bootstrap: [AppComponent],
})
export class AppModule {}
