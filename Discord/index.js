const Discord = require("discord.js");
const client = new Discord.Client();

const axios = require("axios");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/";
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const TIMEZONE_API_URL = "http://api.timezonedb.com/v2/get-time-zone?key=";
const TIMEZONE_API_KEY = process.env.TIMEZONEDB_API_KEY;
const prefix = process.env.PREFIX;

/*
if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL && WEATHER_API_KEY && TIMEZONE_API_KEY)) {
    console.error("Missing config values");
    process.exit(1);
}*/

client.on("message", (message) => {
    // Exit and stop if the prefix is not there or if user is a bot
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    if (message.content.startsWith(prefix + "wtoday")) {
        getWeatherToday(message);
    } else if(message.content.startsWith(prefix + "wtmrw")) {
        getWeatherTomorrow(message);
    }
});

/*
 * Attempts to get the weather today from the location requested by the user.
 */ 
function getWeatherToday(message) {
    var location = message.content.substring(message.content.indexOf(" ")+1);
    axios.get(WEATHER_API_URL+"weather?q="+location+"&appid="+WEATHER_API_KEY+"&units=metric")
        .then(response => {
            var location = response.data.name + ", " + response.data.sys.country;
            var temperature = Math.round(Number.parseFloat(response.data.main.temp)); 
            var condition = response.data.weather[0].description;
            var humidity = Math.round(Number.parseFloat(response.data.main.humidity));
            var wind = Math.round(Number.parseFloat(response.data.wind.speed));
            console.log("Temperature Today: ", temperature);
            console.log("Location Today: ", response.data.name);
            message.channel.send(location + "\n" + "Current temperature: " + temperature.toString() + "°C" + 
            "\n" + condition.charAt(0).toUpperCase() + condition.substr(1) +
            "\n" + "Humidity: " + humidity.toString() + "%" + "\n" + "Wind Speed: " + wind.toString() + " km/h");
        })
        .catch(error => {
            console.log("Weather Today Error: ", error);
            message.channel.send("Could not find weather, make sure you send the message as !wtoday city,2 letter country code(optional)");
        });
}

/*
 * Attempts to get the weather tomorrow from the location requested by the user.
 */
function getWeatherTomorrow(message) {
    var location = message.content.substring(message.content.indexOf(" ")+1);
    var weatherData;
    var timeData;
    var arrayIndex = -1;

    axios.get(WEATHER_API_URL+"forecast?q="+location+"&appid="+WEATHER_API_KEY+"&units=metric")
        .then(response => {
            weatherData = response.data;
            var lat = weatherData.city.coord.lat;
            var long = weatherData.city.coord.lon;
            console.log("Latitude Tmrw: ", lat);
            console.log("Longitude Tmrw: ", long);
            console.log("Location Tmrw:", weatherData.city.name);
            //Find the current time in that city
            return axios.get(TIMEZONE_API_URL+TIMEZONE_API_KEY+"&format=json&by=position&lat="+lat+"&lng="+long);
        })
        .then(response => {
            timeData = response.data;

            //Finds the array index to start searching tomorrow's temperatures in terms of 3 hour segments.
            var cityTime = new Date(timeData.timestamp * 1000);
            console.log("City Time: ", cityTime);
            var cityTimeTmrw = new Date(timeData.timestamp * 1000);
            cityTimeTmrw.setDate(cityTimeTmrw.getDate() + 1);
            var midnightTime = new Date(cityTimeTmrw.getFullYear(), cityTimeTmrw.getMonth(), cityTimeTmrw.getDate(), 0, 0 ,0);
            console.log("City Midnight Time: ", midnightTime);
            var timeToMidnight = midnightTime.getTime() - cityTime.getTime();
            var hoursToMidnight = timeToMidnight / (1000*60*60);
            arrayIndex = Math.floor(hoursToMidnight / 3);
            console.log("Array Index: ", arrayIndex);  

            //Find highest temperature of the next day
            if(arrayIndex !== -1) {
                var maxTemp = -100; //If the temperature is lower than this, there's bigger problems to worry about 
                var maxIndex;
                for(var i = 0; i < 8; i++) {
                    var searchIndex = arrayIndex + i;
                    if(weatherData.list[searchIndex].main.temp > maxTemp) {
                        maxTemp = weatherData.list[searchIndex].main.temp;
                        maxIndex = searchIndex;
                    }
                }
                var location = weatherData.city.name + ", " + weatherData.city.country;
                maxTemp = Math.round(maxTemp); 
                var main = weatherData.list[maxIndex].weather[0].main;
                var condition = weatherData.list[maxIndex].weather[0].description;
                var rain = 0;
                var humidity = weatherData.list[maxIndex].main.humidity;
                var wind = Math.round(weatherData.list[maxIndex].wind.speed);
                if(main.toString().toLowerCase().startsWith("rain")){
                    rain = weatherData.list[maxIndex].rain["3h"];
                    Number.parseFloat(rain.toFixed(1));
                }
                console.log("Max Temperature: ", maxTemp);
                message.channel.send(location + "\n" + "Daytime high: " + maxTemp.toString() + "°C" + 
                "\n" + condition.charAt(0).toUpperCase() + condition.substr(1) + "\n" + "Precipitation: " + rain.toString() + " mm" +
                "\n" + "Humidity: " + humidity.toString() + "%" + "\n" + "Wind Speed: " + wind.toString() + " km/h");
            } else {
                message.channel.send("Could not find weather");
            }
        })
        .catch(error => {
            console.log("Weather Tmrw Error: ", error);
            message.channel.send("Could not find weather, make sure you send the message as !wtmrw city,2 letter country code(optional)");
        });
}

client.login(DISCORD_TOKEN);