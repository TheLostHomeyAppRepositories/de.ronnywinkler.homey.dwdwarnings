'use strict';

const Homey = require('homey');
// Events
const EventEmitter = require('events');
// HTTP handlert
// Axios http rerquests
//const axios = require('axios');
const https = require('https');

// Services
// default update interval (15 min)
const updateIntervalDefault = 15;
// DWD Service-URL
const dwdUrl = 'https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json';

class dwdWarnApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('DWD-WarnApp has been initialized');

    if (process.env.DEBUG === '1') {
      if (this.homey.platform == "local") {
        try {
          require('inspector').waitForDebugger();
        }
        catch (error) {
          require('inspector').open(9911, '0.0.0.0', true);
        }
      }
    }

    // Eventhandler
    this.events = new EventEmitter();
    // app settings stores in class attribute
    this.settings = {};
    // update interval for DWD requests
    this.updateInterval = updateIntervalDefault;
    // last DWD response (JSOS as String)
    this.lastDWDresponse = '';

    // read app settings
    await this.readSettings();
    
    // Register settings listener
    this.homey.settings.on('set', async (key) => {
        if (key === 'settings')
        {
          await this.readSettings();
          await this.stop();
          if (this.active)
            await this.start();
        }
    });

    // Register flow condition listeners
    let hasWarningsCondition = this.homey.flow.getConditionCard('has_warnings');
    hasWarningsCondition.registerRunListener(async (args, state) => {
        return args.device.getCapabilityValue('alarm_warnings'); // true or false
    });
  
    // START WORK...
    if (this.active)
      setTimeout(() => this.start().catch(e => console.log(e)), 2 * 1000 );
    else
      this.log(">>>> Periodical device update NOT ACTIVE <<<<");
  }

  async readSettings(){
    this.settings = await this.homey.settings.get('settings');
    if (this.settings){
      this.updateInterval = parseFloat(this.settings.updateInterval); 
      if (!this.updateInterval || this.updateInterval == 0)
        this.updateInterval = updateIntervalDefault; 
      this.active = this.settings.active;
    }
    else
    {
      this.updateInterval = updateIntervalDefault;
      this.active = true;
      this.homey.settings.set('settings', {
        "updateInterval": updateIntervalDefault,
        "active": true}
        );
    }
  }

  async start(){
    this.log(">>>> Periodical device update STARTED <<<<");
    // start periodical update 
    this.timeoutDevicesUpdate = setTimeout(() => this.devicesUpdate().catch(e => this.log(e)), 1 * 1000 );
  }

  async stop(){
    this.log(">>>> Periodical device update STOPPED <<<<");
    clearTimeout(this.timeoutDevicesUpdate);
  }

  async devicesUpdate() {
    this.timeoutDevicesUpdate = setTimeout(() => this.devicesUpdate().catch(e => this.log(e)), this.updateInterval * 60 * 1000 );
    this.log("devicesUpdate()");
    try {
      // Emit update trigger to warnlocation devices.
      this.events.emit("deviceUpdateWarnlocation");
      // Read DWD data for Warndistricts and push data to devices
      await this.getDWDdata();
      // Result-Handling (Response=>JSONP=>JSON=>DeviceUpdate in getDWDdata()=>parseDWDresponse())
    }
    catch (e) {
      this.log(e.message);
      return;
    }
  }

  async getUrl(url){
    return new Promise( ( resolve, reject ) =>
        {
            try
            {
              let request = https
                .get(url, (response) => { 
                  if (response.statusCode !== 200){
                    response.resume();

                    let message = "";
                    if ( response.statusCode === 204 )
                    { message = "No Data Found"; }
                    else if ( response.statusCode === 400 )
                    { message = "Bad request"; }
                    else if ( response.statusCode === 401 )
                    { message = "Unauthorized"; }
                    else if ( response.statusCode === 403 )
                    { message = "Forbidden"; }
                    else if ( response.statusCode === 404 )
                    { message = "Not Found"; }
                    reject( new Error( "HTTP Error: " + response.statusCode + " " + message ) );
                    return;
                  }
                  else{
                    let rawData = '';
                    response.setEncoding('utf8');
                    response.on( 'data', (chunk) => { rawData += chunk; })
                    response.on( 'end', () => {
                      resolve( rawData );
                    })
                  }
                })
                .on('error', (err) => {
                  reject( new Error( "HTTP Error: " + err.message ) );
                  return;
                });
              request.setTimeout( 5000, function()
                {
                  request.destroy();
                  reject( new Error( "HTTP Catch: Timeout" ) );
                  return;
                });
              }
            catch ( err )
            {
                reject( new Error( "HTTP Catch: " + err.message ) );
                return;
            }
        });

  }

  async getDWDdata(){
    this.log("getDWDdata() -> Listeners for DWD warndistrict: "+this.events.listenerCount('deviceUpdateWarndistrict'));
    if (this.events.listenerCount('deviceUpdateWarndistrict') > 0) {
      // HTTP with Axios:
      // axios
      //   .get(dwdUrl)
      //   .then( async (response) => { this.parseDWDresponse(response) } )
      //   .catch(err => {
      //     this.log('Error: ', err.message);
      //     return;
      //   });
      
      // HTTP with Homey built in https:
      // https
      //   .get(dwdUrl, (response) => { 
      //     const { statusCode } = response;
      //     if (statusCode !== 200){
      //       response.resume();
      //       this.log("http error "+statusCode);
      //       return;
      //     }
      //     let rawData = '';
      //     response.setEncoding('utf8');
      //     response.on( 'data', (chunk) => { rawData += chunk; })
      //     response.on( 'end', () => {
      //       this.log(rawData);
      //       this.parseDWDresponse(rawData) 
      //     })
      //   })
      //   .on('error', (err) => {
      //     this.log('Error: ', err.message);
      //     return;
      //   });

      this.log("getDWDdata() -> Start http request...");

      this.getUrl(dwdUrl)
        .then( data => {
          //this.log("getDWDdata() => Reponse: "+data);
          this.parseDWDresponse(data) 
        })
        .catch( (err) => {
          this.log('getDWDdata() => HTTP-Error: ', err.message);
          return;
        });
    }
    else {
      this.log("getDWDdata() -> No Listeners for DWD warndistrict.");
      return;
    }
  }

  async parseDWDresponse(data){
    this.log("parseDWDresponse()");
    let jsonString = await this.formatJSON(data);
    // this.log("JSON-String: ");
    // this.log(jsonString);
    if( (jsonString) && (jsonString != this.lastDWDresponse) ){
      this.log("New warnings!");
      this.lastDWDresponse = jsonString;
      try{
        // catch JSON convert errors
        let json = JSON.parse(jsonString).warnings;
        // this.log("JSON: ");
        // this.log(json);

        var array = [];
        for(var i in json)
          array.push([i, json [i]]);
        // this.log("Array:");
        // this.log(array);

        // Emit new warnings list to devices. 
        // Devices will filter the list and read the warnings into capabilities.
        this.events.emit("deviceUpdateWarndistrict", array);
      }
      catch(error){
        this.log("parseDWDresponse() Error JSON convert: "+error.message+" JSON: "+jsonString);
      }
    }
    else{
      this.log("No new warnings.");
    }
  }

  async formatJSON(dwdResponse){
    this.log("formatJSON()");
    return await this.unwrapJSONP(dwdResponse);
  }

  async unwrapJSONP(jsonp){
    let json = jsonp.replace('warnWetter.loadWarnings(', '');
    json = json.substring(0, json.length-2);
    return json;
  }

  // deviceUpdateWarndistrict(warncellid, jsonWarnings){
  //   // emit event to device instance
  //   this.log("deviceUpdateWarndistrict()")
  //   this.events.emit("deviceUpdateWarndistrict", warncellid, deviceData);
  // }

  // updateLog(newMessage, errorLevel = 1)
  // {
  //     if ((errorLevel == 0) || this.homey.settings.get('logEnabled'))
  //     {
  //         console.log(newMessage);
  
  //         // const nowTime = new Date(Date.now());
  
  //         // this.diagLog += "\r\n* ";
  //         // this.diagLog += (nowTime.getHours());
  //         // this.diagLog += ":";
  //         // this.diagLog += nowTime.getMinutes();
  //         // this.diagLog += ":";
  //         // this.diagLog += nowTime.getSeconds();
  //         // this.diagLog += ".";

  //         const tz  = this.homey.clock.getTimezone();
  //         const nowTime = new Date();
  //         const now = nowTime.toLocaleString('de-DE', 
  //             { 
  //                 hour12: false, 
  //                 timeZone: tz,
  //                 hour: "2-digit",
  //                 minute: "2-digit",
  //                 day: "2-digit",
  //                 month: "2-digit",
  //                 year: "numeric"
  //             });
  //         let date = now.split(", ")[0];
  //         date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
  //         let time = now.split(", ")[1];
          
  //         this.diagLog += "\r\n* ";
  //         this.diagLog += date + " " + time + ":";
  //         this.diagLog += nowTime.getSeconds();
  //         this.diagLog += ".";
  //         let milliSeconds = nowTime.getMilliseconds().toString();
  //         if (milliSeconds.length == 2)
  //         {
  //             this.diagLog += '0';
  //         }
  //         else if (milliSeconds.length == 1)
  //         {
  //             this.diagLog += '00';
  //         }
  //         this.diagLog += milliSeconds;
  //         this.diagLog += "\r\n";
  
  //         this.diagLog += newMessage;
  //         this.diagLog += "\r\n";
  //         if (this.diagLog.length > 60000)
  //         {
  //             this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
  //         }
  //         this.homey.api.realtime('de.ronnywinkler.homey.gruenbeck.logupdated', { 'log': this.diagLog });
  //     }
  // }

}

module.exports = dwdWarnApp;