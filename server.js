'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
//app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelps);
app.get('/meetups', getMeetups);
app.get('/movies', getMovies);
app.get('/trails', getTrails);
app.listen(PORT, () => console.log(`Listening on ${PORT}`));


app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(location => {
      response.send(location)
    })
    .catch(error => handleError(error, response));
})



// *********************
// MODELS
// *********************

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.formatted_address;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function Meetup(meetup) {
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
}

function Yelps(review) {
  this.url = review.url;
  this.name = review.name;
  this.rating = review.rating;
  this.price = review.price;
  this.image_url = review.image_url;
}

function Movie(movie) {
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = 'https://image.tmdb.org/t/p/w500' + movie.backdrop_path;
  this.overview = movie.overview;
}

function Trail(trail){
  this.trail_url = trail.url;
  this.name = trail.name;
  this.loaction = trail.location;
  this.length = trail.length;
  this.condition_date = trail.conditionDate;
  this.conditions = trail.conditionsStatus;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
}


// *********************
// HELPER FUNCTIONS
// *********************

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// function checkIfInDB(request, response, dbName, ifInDB, notInDB){
//   const SQL = `SELECT * FROM ${dbName} WHERE location_id=$1;`;
//   const values = [request.query.data.id];
//   return client.query(SQL, values)
//     .then(result => {
//       if(result.rowCount > 0) {
//         ifInDB;
//       }else{
//         notInDB;
//       }
//     })
//     .catch(error => handleError(error, response));
// }


function getLocation(query) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  // Make the query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        // console.log('From SQL');
        return result.rows[0];

        // Otherwise get the location information from the Google API
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

        return superagent.get(url)
          .then(data => {
            // console.log('FROM API line 90');
            // Throw an error if there is a problem with the API request
            if (!data.body.results.length) { throw 'no Data' }

            // Otherwise create an instance of Location
            else {
              let location = new Location(query, data.body.results[0]);
              // console.log('98', location);

              // Create a query string to INSERT a new record with the location data
              let newSQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id;`;
              // console.log('102', newSQL)
              let newValues = Object.values(location);
              // console.log('104', newValues)

              // Add the record to the database
              return client.query(newSQL, newValues)
                .then(result => {
                  // console.log('108', result.rows);
                  // Attach the id of the newly created record to the instance of location.
                  // This will be used to connect the location to the other databases.
                  // console.log('114', result.rows[0].id)
                  location.id = result.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          })
          .catch(error => console.log('Error in SQL Call'));
      }
    });
}

function getWeather(request, response) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  const values = [request.query.data.id];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0) {
        // console.log('From SQL');
        response.send(result.rows);
      }else{
        const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
        
        superagent.get(url)
          .then(result => {
            const weatherSummaries = result.body.daily.data.map(day => {
              const summary = new Weather(day);
              return summary;
            });
            let newSQL = `INSERT INTO weathers(forecast,time,location_id) VALUES ($1, $2, $3);`;
            weatherSummaries.forEach(summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues)
                .then(result => {
                  // console.log('155', result.rows);
                  this.log('158', result.rows[0].id)
                })
                .catch(console.error)
            })
            response.send(weatherSummaries);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getMeetups(request, response) {
  const SQL =`SELECT * FROM meetups WHERE location_id=$1;`;
  const values = [request.query.data.id];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0){
        response.send(result.rows);
      }else{
        const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}&key=${process.env.MEETUPS_API_KEY}`
  
        superagent.get(url)
          .then(result => {
            const meetups = result.body.events.map(meetup => {
              const event = new Meetup(meetup);
              return event;
            });
            let newSQL = `INSERT INTO meetups(link,name,creation_date,host,location_id) VALUES ($1,$2,$3,$4,$5);`;
            meetups.forEach(summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues)
                .then(result => {
                  // console.log('155',result.rows);
                  this.log('158',result.rows[0].id)
                })
                .catch(console.error)
            })
            response.send(meetups);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getYelps(request, response){
  const SQL =`SELECT * FROM yelps WHERE location_id=$1;`;
  const values = [request.query.data.id];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0){
        response.send(result.rows);
      }else{
        const url = `https://api.yelp.com/v3/businesses/search?latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`
  
        superagent.get(url)
          .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
          .then(result => {
            const yelpArr = result.body.businesses.map(reviews => {
              const review = new Yelps(reviews);
              return review;
            });
            let newSQL = `INSERT INTO yelps(url,name,rating,price,image_url,location_id) VALUES ($1,$2,$3,$4,$5,$6);`;
            yelpArr.forEach(summary => {
              let newValues = Object.values(summary);
              console.log('253', Object.values(summary));
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues)
                .then(result => {
                  
                  this.log('158',result.rows[0].id)
                })
                .catch(console.error)
            })
            response.send(yelpArr);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getMovies(request,response){
  const SQL =`SELECT * FROM movies WHERE location_id=$1;`;
  const values = [request.query.data.id];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0){
        response.send(result.rows);
      }else{
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${request.query.data.search_query}`;
  
        superagent.get(url)
          .then(result => {
            const movies = result.body.results.map(movie => {
              const aMovie = new Movie(movie);
              return aMovie;
            });
            let newSQL = `INSERT INTO movies(title,released_on,total_votes,average_votes,popularity,image_url,overview,location_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8);`;
            movies.forEach(summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues);
            })
            response.send(movies);
          })
          .catch(error => handleError(error, response));
      }
    })
}

function getTrails(request,response){
  const SQL =`SELECT * FROM trails WHERE location_id=$1;`;
  const values = [request.query.data.id];

  return client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0){
        response.send(result.rows);
      }else{
        const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=10&key=${process.env.TRAILS_API_KEY}`;
  
        superagent.get(url)
          .then(result => {
            const trails = result.body.trails.map(movie => {
              const trail = new Trail(movie);
              return trail;
            });
            let newSQL = `INSERT INTO trails(trail_url,name,location,length,condition_date,conditions,stars,star_votes,location_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);`;
            trails.forEach(summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues);
            })
            response.send(trails);
          })
          .catch(error => handleError(error, response));
      }
    })
}
