'use strict'

//Load environdment Vars from .env
require('dotenv').config();

// App Dependancies
const express = require ('express');
const cors = require('cors');
const superagent = require('superagent');

//App Setup
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

//API routes

//locations
app.get('/location', (request, response) => {
  searchToLatLong(request.query.data)
    .then(location => response.send(location))
    .catch(error => handleError(error, response));
});

//weather
app.get('/weather', (request, response) => {
  getWeather(request.query.data)
    .then(data => response.send(data))
    .catch(error => handleError(error, response))
})

//meetups
app.get('/meetups', (request, response) => {
  getMeetups(request.query.data)
    .then(data => response.send(data))
    .catch(error => handleError(error, response))
})

//catch-all error handler
app.use('*', handleError);

// Make sure server is listening for requests
app.listen(PORT, () => console.log(`App is up on ${PORT}`))


// Helper Functions

// Err Handler
function handleError(err, res) {
  //console.error(err);
  if (res) res.status(500).send('Sorry, something went terribly wrong. Toodles!');
}

//creates a new object with our geocode data
function searchToLatLong(query) {
  const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(geoUrl)
    .then(res => new Location(query, res))
    .catch(error => handleError);
}

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

// creates array of objects with our weather data
function getWeather(location) {
  const weatherUrl = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${location.latitude},${location.longitude}`;
  return superagent.get(weatherUrl)
    .then(res => {
      return res.body.daily.data.map(day => new Weather(day));
    })
    .catch(error => handleError);
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time *1000).toString().slice(0,15);
}

//creates array of objects with our meetup data
function getMeetups(location) {
  let meetupsURL = `https://api.meetup.com/find/groups?&query=${location.search_query}&page=20&key=${process.env.MEETUPS_API_KEY}`;

  return superagent.get(meetupsURL)
    .then(res => {
      console.log(res.body[0]);
      return res.body.map(event => new Meetups(event))
    })
    .catch(error => handleError)


}

function Meetups(event){
  this.name = event.name;
  this.link = event.link;
  this.creation_date = new Date(event.created *1000).toString().slice(0,15);
  this.host = event.organizer.name;
}
