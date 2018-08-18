'use strict';
// Imports dependencies and sets up http server
const
    express = require('express'),
    request = require('request'),
    body_parser = require('body-parser'),
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
    //Can't we just do if(message.text)?
    if (messageText) {
        if(messageText.includes("!wtoday")) {
            var location = messageText.substring(messageText.indexOf(" ")+1);
            request((WEATHER_API_URL+"weather?q="+location+"&appid="+WEATHER_API_KEY+"&units=metric"), {json: true}, (error, response, data) => {
                if(error) {
                    console.log("Error:", error);
                } else if(response.statusCode !== 200) {
                    console.log("Status:", response.statusCode);
                } else {
                    var temperature = Math.round(Number.parseFloat(data.main.temp));
                    var cast = data.weather.0.main;
                    var description = data.weather.0.description;
                    var humidity = Math.round(Number.parseFloat(data.main.humidity));
                    var wind = Math.round(Number.parseFloat(data.wind.speed));

                    console.log(temperature);
                    console.log(humidity);
                    console.log(wind);
                    console.log(data.name);
                    sendTextMessage(senderID, 
                                    "Current temperature: " + temperature.toString() + "°C" + 
                                    "\n" + cast.toString() +
                                    "\n" + description.toString() +
                                    "\n" + "Humidity: " + humidity.toString() + "%" + 
                                    "\n" + "Wind Speed: " +wind.toString() + " km/h");
                }
            }); 
        } else if(messageText.includes("!wtmrw")) {
            var location = messageText.substring(messageText.indexOf(" ")+1);
            request((WEATHER_API_URL+"forecast?q="+location+"&appid="+WEATHER_API_KEY+"&units=metric"), {json: true}, (error, response, data) => {
                if(error) {
                    console.log("Error:", error);
                } else if(response.statusCode !== 200) {
                    console.log("Status:", response.statusCode);
                } else {
                    getAfternoonTime(data.city.coord.lat, data.city.coord.lon);
                    /*
                    var temperature = Math.round(Number.parseFloat(data.main.temp)); 
                    console.log(temperature);
                    console.log(data.name);
                    sendTextMessage(senderID, temperature.toString() + "°C");*/
                }
            }); 
            sendTextMessage(senderID, "Weather Tomorrow");
        } 
        else if (messageText.includes("get started")){
            sendGetStarted(senderID);
        } else {
            sendTextMessage(senderID, messageText);
        } 
    }
    /**else if (message.attachment) {
        let attachment_url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Title",
                        "subtitle": "Subtitle",
                        "image_url": attachment_url,
                        "buttons": [
                            {
                                "type": "postback",
                                "title": "Yes!",
                                "payload": "yes",
                            },
                            {
                                "type": "postback",
                                "title": "No!",
                                "payload": "no",
                            },
                        ]
                    }]
                }
            }
        }
    }**/
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

    console.log("Received postback for user %d and page %d with payload '%s' " + "at %d", 
    senderID, recipientID, payload, timeOfPostback);
    
    switch(payload){
        case 'w_today':
          sendTextMessage(senderID, "Weather Today");
          break;
        case 'w_tomorrow':
          sendTextMessage(senderID, "Weather Tomorrow");
          break;
        default:
          sendTextMessage(senderID, "Postback called");
    }
}
 /* Returns the number of 3 hour segments there are from current time to 2pm the next day.
 */
function getAfternoonTime(lat, long) {
    request((TIMEZONE_API_URL+TIMEZONE_API_KEY+"&format=json&by=position&lat="+lat+"&lng="+long), {json: true}, (error, response, data) => {
        if(error) {
            console.log("Error:", error);
        } else if(response.statusCode !== 200) {
            console.log("Status:", response.statusCode);
        } else {
            var cityTime = new Date(data.timestamp);
            var cityTimeTmrw = new Date();
            cityTimeTmrw.setDate(cityTime.getDate());
            console.log(data.timestamp);
            console.log(cityTime);
            cityTimeTmrw.setDate(cityTime.getDate() + 1);
            console.log(cityTime);
            console.log(cityTimeTmrw);
        }
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
 * Send a button message using the Send API.
 *
 */
function sendGetStarted(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Hi, I'm Weather Bot! Tap a forecast to view more information.",
                    buttons: [{
                        type: "postback",
                        title: "Weather Today",
                        payload: "w_today"
                    }, {
                        type: "postback",
                        title: "Weather Tomorrow",
                        payload: "w_tomorrow"
                    }]
                }
            }
        }
    };
  callSendAPI(messageData);
}

function sendWeather(recipientID, temperature){
    var messageData = {
        recipient: {
            id: recipientID
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "list",
                    top_element_style: "compact",
                    elements: [
                        {
                            title: "Temperature",
                            subtitle: temperature,
                        },
                        {
                            title: "Precipitation"

                        }
                    ]
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