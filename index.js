'use strict';
// Imports dependencies and sets up http server
const
    axios = require('axios'),
    body_parser = require('body-parser'),
    express = require('express'),
    request = require('request'),
    app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

/*
 * Setup of configuration variables. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.MESSENGER_APP_SECRET;
// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN;

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = process.env.SERVER_URL;

const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/";
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const TIMEZONE_API_URL = "http://api.timezonedb.com/v2/get-time-zone?key=";
const TIMEZONE_API_KEY = process.env.TIMEZONEDB_API_KEY;


if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
    console.error("Missing config values");
    process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 * 
 * Accepts POST requests at /webhook endpoint
 */
app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function (pageEntry) {
            // Iterate over each messaging event
            pageEntry.messaging.forEach(function (messagingEvent) {
                if (messagingEvent.message) {
                    receivedMessage(messagingEvent);
                } else if (messagingEvent.postback) {
                    receivedPostback(messagingEvent);
                } else {
                    console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                }
            });
        });
        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    var requestURL = "http://api.openweathermap.org/data/2.5/weather?q=London,uk&appid=7dcd47e7d9822e605a5ee663d66c2135";

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageText = message.text;
    
    if (messageText) {
        if(messageText.includes("!wtoday")) {
            getWeatherToday(messageText, senderID);
        } else if(messageText.includes("!wtmrw")) {
            getWeatherTomorrow(messageText, senderID);          
        } else if(messageText.toUpperCase().includes("WEATHER")) {
            sendWeather(senderID, messageText);
        } else {
            sendTextMessage(senderID, messageText);
        } 
    }
    else {
        console.log("Undefined message contents");
    }
    //Send the response message
    callSendAPI(message);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 * Returns weather based on input from get started menu
 *
 */
function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;
    var payload = event.postback.payload;

    var location = payload.substring(payload.indexOf(" ")+1);

    console.log("Received postback for user %d and page %d with payload '%d' " + "at %d", 
    senderID, recipientID, payload, timeOfPostback);
    
    if (payload.includes("w_today")){
        getWeatherToday("!wtoday" + " " + location.toString(), senderID);
    } else if (payload.includes("w_tomorrow")){
        getWeatherTomorrow("!wtmrw" + " " + location.toString(), senderID);
    } else {
        console.log("Postback called");
    }
}
 /* Returns the number of 3 hour segments there are from current time to 2pm the next day.
 * Returns the array index number to get temperatures of the next day.
 * Attempts to get the weather today from the location requested by the user.
 */ 
function getWeatherToday(messageText, senderID) {
    var location = messageText.substring(messageText.indexOf(" ")+1);
    axios.get(WEATHER_API_URL+"weather?q="+location+"&appid="+WEATHER_API_KEY+"&units=metric")
        .then(response => {
            var location = response.data.name + ", " + response.data.sys.country;
            var temperature = Math.round(Number.parseFloat(response.data.main.temp));
            var condition = response.data.weather[0].description;
            var humidity = Math.round(Number.parseFloat(response.data.main.humidity));
            var wind = Math.round(Number.parseFloat(response.data.wind.speed));
            console.log("Temperature Today: ", temperature);
            console.log("Location Today: ", response.data.name);
            sendTextMessage(senderID, location + "\n" + "Current temperature: " + temperature.toString() + "°C" + 
                                "\n" + condition.charAt(0).toUpperCase() + condition.substr(1) +
                                "\n" + "Humidity: " + humidity.toString() + "%" + "\n" + "Wind Speed: " + wind.toString() + " km/h");
        })
        .catch(error => {
            console.log("Weather Today Error: ", error);
            sendTextMessage(senderID, "Could not find weather, make sure you send the message as !wtoday city,2 letter country code(optional)");
        });
}

/*
 * Attempts to get the weather tomorrow from the location requested by the user.
 */
function getWeatherTomorrow(messageText, senderID) {
    var location = messageText.substring(messageText.indexOf(" ")+1);
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
                for(var i = 0; i < 8; i++) {
                    var searchIndex = arrayIndex + i;
                    if(weatherData.list[searchIndex].main.temp > maxTemp) {
                        maxTemp = weatherData.list[searchIndex].main.temp;
                    }
                }
                var location = weatherData.city.name + ", " + weatherData.city.country;
                maxTemp = Math.round(maxTemp);
                console.log("Max Temperature: ", maxTemp);
                sendTextMessage(senderID, location + "\n" + "Daytime high: " + maxTemp.toString() + "°C");
            } else {
                sendTextMessage(senderID, "Could not find weather");
            }
        })
        .catch(error => {
            console.log("Weather Tmrw Error: ", error);
            sendTextMessage(senderID, "Could not find weather, make sure you send the message as !wtmrw city,2 letter country code(optional)");
        });
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };
    callSendAPI(messageData);
}

/*
 * Sends button template message with forecasts
 * Location is passed on through payload attribute of message attachement
 */
function sendWeather(recipientId, messageText) {
    var location = messageText.substring(messageText.indexOf(" ")+1);
    var messageData = {
        recipient: {id: recipientId},
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Hi, I'm Weather Bot! Tap a forecast to view more information.",
                    buttons: [{
                        type: "postback",
                        title: "Weather Today",
                        payload: "w_today" + " " + location
                    }, {
                        type: "postback",
                        title: "Weather Tomorrow",
                        payload: "w_tomorrow" + " " + location
                    }]
                }
            }
        }
    };
  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
    console.log(messageData);
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
        }
    });
}