import { Component, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, fromEvent, interval, from, merge } from 'rxjs';
import { map, flatMap, share, distinct, pluck, bufferTime, filter, retry, distinctUntilChanged, pairwise } from 'rxjs/operators';

import * as L from 'leaflet';
import { latLng, tileLayer, Map, layerGroup } from 'leaflet';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {

	constructor(private httpClient: HttpClient) {}

	private readonly QUAKE_URL = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/' +
	'summary/all_day.geojsonp';

	private map: Map;
	private codeLayers = {};
	private quakeLayer;

	ngAfterViewInit(): void {
		this.map = L.map('map').setView([33.858631, -118.279602], 7);
		tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(this.map);
		this.quakeLayer = layerGroup([]).addTo(this.map);

		const quakes$ = interval(5000)
			.pipe(
				flatMap(() => {
					return this.loadJSONP({
						url: this.QUAKE_URL,
						callbackName: 'eqfeed_callback',
					}).pipe(retry(3));
				}),
				flatMap(result => from(result.response.features)),
				distinct(quake => quake.properties.code),
				share()
			);

		quakes$.subscribe(quake => {
			const coords = quake.geometry.coordinates;
			const size = quake.properties.mag * 10000;

			const circle = L.circle([coords[1], coords[0]], size).addTo(this.map);
			this.quakeLayer.addLayer(circle);
			this.codeLayers[quake.id] = this.quakeLayer.getLayerId(circle);
		});

		const tableBody = document.getElementById('quakes_info');
		quakes$.pipe(
			pluck('properties'),
			map(properties => this.makeRow(properties)),
			//#region this code is not needed after we implemented getRowFromEvent function

			// bufferTime executes every 500ms no matter what, and if there have been no
			// incoming values, it will yield an empty array. We’ll filter those.
			// bufferTime(500),
			// filter(rows => rows.length > 0),
			// map(rows => {
			// 	const fragment = document.createDocumentFragment();
			// 	rows.forEach(row => {
			// 		const circle = this.quakeLayer.getLayer(this.codeLayers[row.id]);

			// 		this.isHovering(row).subscribe(hovering => {
			// 			circle.setStyle({
			// 				color: hovering ? '#ff0000' : '#0000ff'
			// 			});
			// 		});

			// 		fromEvent(row, 'click').subscribe(() => {
			// 			this.map.panTo(circle.getLatLng());
			// 		});

			// 		fragment.appendChild(row);
			// 	});
			// 	return fragment;
			// })
			//#endregion
		)
		.subscribe(fragment => {
			tableBody.appendChild(fragment);
		});

		this.getRowFromEvent(tableBody, 'mouseover')
			.pipe(pairwise())
			.subscribe(rows => {
				const prevCircle = this.quakeLayer.getLayer(this.codeLayers[rows[0].id]);
				const currCircle = this.quakeLayer.getLayer(this.codeLayers[rows[1].id]);
				prevCircle.setStyle({ color: '#0000ff' });
				currCircle.setStyle({ color: '#ff0000' });
			});

		this.getRowFromEvent(tableBody, 'click')
			.subscribe((row) => {
				const circle = this.quakeLayer.getLayer(this.codeLayers[row.id]);
				this.map.panTo(circle.getLatLng());
			});
	}

	private makeRow(props): HTMLTableRowElement {
		const row = document.createElement('tr');
		row.id = props.net + props.code;
		const time = new Date(props.time).toString();

		[props.place, props.mag, time].forEach(text => {
			const cell = document.createElement('td');
			cell.textContent = text;
			row.appendChild(cell);
		});

		return row;
	}

	private getRowFromEvent(tableBody, eventName: string) {
		return fromEvent(tableBody, eventName)
			.pipe(
				filter((e: Event) =>
					e.target.tagName === 'TD' && e.target.parentNode.id.length
				),
				pluck('target' , 'parentNode'),
				distinctUntilChanged()
			);
	}

	private loadJSONP(settings) {
		// return this.httpClient.jsonp(settings.url, settings.callbackName)

		const callbackName = settings.callbackName;

		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = settings.url;

		window[callbackName] = data => {
			window[callbackName].data = data;
		};

		return new Observable(observer => {
			const handler = (e: Event) => {
				const status = e.type === 'error' ? 400 : 200;
				const response = window[callbackName].data;
				if (status === 200) {
					observer.next({
						status,
						responseType: 'jsonp',
						response,
						originalEvent: e
					});
					observer.complete();
				} else {
					observer.error({
						type: 'error',
						status,
						originalEvent: e
					});
				}
			};

			script.onload = script.onreadystatechange = script.onerror = handler;

			const head = window.document.getElementsByTagName('head')[0];
			head.insertBefore(script, head.firstChild);
		});
	}

	private isHovering(element): Observable<boolean> {
		const over = fromEvent(element, 'mouseover').pipe(map(() => true));
		const out = fromEvent(element, 'mouseout').pipe(map(() => false));
		return merge(
			over,
			out
		);
	}
}
