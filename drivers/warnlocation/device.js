'use strict';

const { Device } = require('homey');
const crypto = require('crypto');
// DWD Service-URL
const dwdUrl = 'https://maps.dwd.de/geoserver/dwd/wfs?service=WFS&request=GetFeature&typeName=dwd:Warnungen_Gemeinden&srsName=EPSG:4326&&outputFormat=application/json&cql_filter=WARNCELLID=';
// EC_II Types => Warning level
const ecii_level = require('./ecii.js');
// state URL for warnmap
const state_url = require('../../state_url.js');
// country URL
const countryUrl = 'https://www.dwd.de/DWD/warnungen/warnapp_gemeinden/json/warnungen_gemeinde_map_de.png';

class warnlocationDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
      this.log('Warnlocation has been initialized');

      await this.updateCapabilities();

      // Register bind-references fopr event handler
      this.onDeviceUpdateHandler = this.onDeviceUpdate.bind(this);

      // register eventhandler for device updates
      this.homey.app.events.on("deviceUpdateWarnlocation", this.onDeviceUpdateHandler);

      // Register Image
      this.registerImage();
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)

        // New capabilities with version 1.0.9
        if (!this.hasCapability('warning_04_type')){
          this.addCapability('warning_04_type');
        }
        if (!this.hasCapability('warning_04_level')){
          this.addCapability('warning_04_level');
        }
        if (!this.hasCapability('warning_04_period')){
          this.addCapability('warning_04_period');
        }
        if (!this.hasCapability('warning_04_description')){
          this.addCapability('warning_04_description');
        }
        if (!this.hasCapability('warning_04_msgtype')){
          this.addCapability('warning_04_msgtype');
        }
        if (!this.hasCapability('warning_04_group')){
          this.addCapability('warning_04_group');
        }
        if (!this.hasCapability('warning_04_severity')){
          this.addCapability('warning_04_severity');
        }
        if (!this.hasCapability('warning_04_type_ecii')){
          this.addCapability('warning_04_type_ecii');
        }
        if (!this.hasCapability('warning_04_parametername')){
          this.addCapability('warning_04_parametername');
        }
        if (!this.hasCapability('warning_04_parametervalue')){
          this.addCapability('warning_04_parametervalue');
        }
        if (!this.hasCapability('warning_05_type')){
          this.addCapability('warning_05_type');
        }
        if (!this.hasCapability('warning_05_level')){
          this.addCapability('warning_05_level');
        }
        if (!this.hasCapability('warning_05_period')){
          this.addCapability('warning_05_period');
        }
        if (!this.hasCapability('warning_05_description')){
          this.addCapability('warning_05_description');
        }
        if (!this.hasCapability('warning_05_msgtype')){
          this.addCapability('warning_05_msgtype');
        }
        if (!this.hasCapability('warning_05_group')){
          this.addCapability('warning_05_group');
        }
        if (!this.hasCapability('warning_05_severity')){
          this.addCapability('warning_05_severity');
        }
        if (!this.hasCapability('warning_05_type_ecii')){
          this.addCapability('warning_05_type_ecii');
        }
        if (!this.hasCapability('warning_05_parametername')){
          this.addCapability('warning_05_parametername');
        }
        if (!this.hasCapability('warning_05_parametervalue')){
          this.addCapability('warning_05_parametervalue');
        }
    }

    async registerImage(){
      // Image for WarnMap
      let imageUrl = await this.getImageURL();
      const mapImage = await this.homey.images.createImage();
      mapImage.setUrl(imageUrl);
      this.setCameraImage('warnmap', this.homey.__('warnmap.titleState'), mapImage);
      // Image for Germany WarnMap
      const mapImageGermany = await this.homey.images.createImage();
      mapImageGermany.setUrl(countryUrl);
      this.setCameraImage('warnmapGermany', this.homey.__('warnmap.titleCountry'), mapImageGermany);
    }

    async getImageURL(){
      try{
        let state = this.getData().id.toString().substring(1, 3);
        //this.log("State: "+state);
          let url = state_url.filter(x => (x.state == state))[0].url;
        //this.log("URL: "+url);
        return url;
      }
      catch(error){
        return null;
      }
    } 

    async onDeviceUpdate(data){
      this.log("onDeviceUpdate() Warncell-ID: "+this.getData().id);
      let url = dwdUrl + this.getData().id;
      this.homey.app.getUrl(url)
      .then( data => {
        //this.log("getDWDdata() => Reponse: "+data);
        this.parseDWDresponse(data) 
      })
      .catch( (err) => {
         this.log('onDeviceUpdate() => HTTP-Error: ', err.message);
         return;
      });

    }

    async getWarningsHash(warningList){
      if (warningList.length == 0){
        return '';
      }
      else{
        let content = '';
        for(let i=0; i < warningList.length; i++ ){
          //this.log("getWarningsHash Index "+i+" Entry: "+warningList[i].properties.ONSET );
          content = content + warningList[i].properties.EVENT;
          content = content + warningList[i].properties.EC_II;
          content = content + warningList[i].properties.ONSET;
          content = content + warningList[i].properties.EXPIRES;
          //content = content + warningList[i].properties.MSGTYPE;
          content = content + warningList[i].properties.EC_GROUP;
          content = content + warningList[i].properties.SEVERITY;
          content = content + warningList[i].properties.PARAMETERNAME;
          content = content + warningList[i].properties.PARAMETERVALUE;
          content = content + warningList[i].properties.DESCRIPTION;
        }
        return crypto.createHash('sha1').update(content).digest('base64').toString();
      }
    }

    async parseDWDresponse(data){
      let json = JSON.parse(data);
      if (! json.features){
        // no valid JSON data
        return;
      }
      let warningList = json.features;
      //warningList.sort((a, b) => a.properties.ONSET < b.properties.ONSET);
      warningList.sort((a, b) => {
        if (a.properties.ONSET < b.properties.ONSET) {
          return -1;
        }
        if (a.properties.ONSET > b.properties.ONSET) {
          return 1;
        }
        // Else: equal
        if (a.properties.ONSET == b.properties.ONSET) {
          if (a.properties.EXPIRES < b.properties.EXPIRES) {
            return -1;
          }
          if (a.properties.EXPIRES > b.properties.EXPIRES) {
            return 1;
          }
          // Esle: equal
          if (a.properties.EXPIRES == b.properties.EXPIRES) {
            if (a.properties.EC_II < b.properties.EC_II) {
              return -1;
            }
            if (a.properties.EC_II > b.properties.EC_II) {
              return 1;
            }
            // Else: All values are identical (begin, end, ecii)
            return 0;
          }
        }
        // Default return value
        return 0;      
      });

      let hash = await this.getWarningsHash(warningList);

      //if ( await this.getCapabilityValue("last_warnings") != JSON.stringify(warningList) ){
      if ( await this.getCapabilityValue("last_warnings") != hash ){
        //this.log("WarningList: "+warningList);
        if (warningList.length == 0){
          // no warnings, clear all capabilities
          try{
            this.log("onDeviceUpdate() - Changed warnings bot no entiries in list - clear capabilities.");
            //this.setCapabilityValue("last_warnings", JSON.stringify(warningList));
            this.setCapabilityValue("last_warnings", hash);
            this.setCapabilityValue("measure_highest_level", 0);
            this.setCapabilityValue("measure_type", '');
            this.setCapabilityValue("measure_number_of_warnings", 0);
            // Old warnings existing? Create timeline message about cancel of warnings
            let messageCapability = this.homey.__("warning.cancelled") +' **'+ this.getName() + '**';
            this.homey.notifications.createNotification({excerpt: messageCapability }).catch(error => {this.error('Error sending notification: '+error.message)});
            // set complete warning text into capability
            messageCapability = this.homey.__("warning.cancelled") +' '+ this.getName();
            // this.log("setCapabilityValue: measure_warnings:" + capabilityMessage);
            this.setCapabilityValue("measure_warnings", messageCapability);
            // alarm_warnings
            this.setCapabilityValue("alarm_warnings", false);
            // clear single warning capabilities
            this.clearWarningCapability(0);
            this.clearWarningCapability(1);
            this.clearWarningCapability(2);
            this.clearWarningCapability(3);
            this.clearWarningCapability(4);
          }
          catch (error){
            this.log("Error setting capabilities: " + error.message);
          }
        }
        else{
          // message exists, write to capabilities
          try{
            this.log("onDeviceUpdate() - Changed warnings!");
            // this.log("setCapabilityValue: last_warnings");
            //this.setCapabilityValue("last_warnings", JSON.stringify(warningList));
            this.setCapabilityValue("last_warnings", hash);
            // this.log("setCapabilityValue: measure_highest_level:" + warningList[0].level);
            //this.setCapabilityValue("measure_highest_level", this.getWarningLevelByECII(warningList[0].properties.EC_II));
            this.setCapabilityValue("measure_highest_level", this.getHighestWarningLevel(warningList));
            // this.log("setCapabilityValue: measure_type:" + warningList[0].event);
            this.setCapabilityValue("measure_type", this.getHighestWarningType(warningList)); //warningList[0].properties.EVENT);
            // this.log("setCapabilityValue: measure_number_of_warnings:" + warningList.length);
            if (warningList.length > 0){
              this.setCapabilityValue("measure_number_of_warnings", warningList.length);
            }
            else{
              this.setCapabilityValue("measure_number_of_warnings", 0);
            }

            // Send timeline message for each warning
            // don't sort by warning level. Keep sort by start time
            //warningList.sort((a, b) => this.getWarningLevelByECII(a.properties.EC_II) - this.getWarningLevelByECII(b.properties.EC_II));
            let capabilityMessage = '';
            for(let i=0; i < warningList.length; i++ ){
              let message = await this.composeMessage(warningList[i], true);
              // this.log("Message");
              // this.log(message);
              this.homey.notifications.createNotification({excerpt: message}).catch(error => {this.error('Error sending notification: '+error.message)});
              // concatenate messages for capability (without bold text)
              let messageCapability = await this.composeMessage(warningList[i], false);
              if (capabilityMessage == ''){
                capabilityMessage = messageCapability;
              }
              else
              {
                capabilityMessage = capabilityMessage + " + + + " + messageCapability;
              }
              // set warning capabilities 01..03 
              await this.setWarningCapability(i, warningList[i]);
            } 
            // clear unused warning capabilities
            if (warningList.length < 2){
              this.clearWarningCapability(1);
            }
            if (warningList.length < 3){
              this.clearWarningCapability(2);
            }
            if (warningList.length < 4){
              this.clearWarningCapability(3);
            }
            if (warningList.length < 5){
              this.clearWarningCapability(4);
            }
            // set complete warning text into capability
            // this.log("setCapabilityValue: measure_warnings:" + capabilityMessage);
            this.setCapabilityValue("measure_warnings", capabilityMessage);

            // alarm_warnings
            if (warningList.length > 0){
              this.setCapabilityValue("alarm_warnings", true);
            }
            else{
              this.setCapabilityValue("alarm_warnings", false);
            }
          }
          catch (error){
            this.log("Error setting capabilities: " + error.message);
          }
        }
      }
      else
      {
        this.log("No new warnings found for device");
        // clear unused warning capabilities
        if (warningList.length < 1){
          this.clearWarningCapability(0);
        }
        if (warningList.length < 2){
          this.clearWarningCapability(1);
        }
        if (warningList.length < 3){
          this.clearWarningCapability(2);
        }
        if (warningList.length < 4){
          this.clearWarningCapability(3);
        }
        if (warningList.length < 5){
          this.clearWarningCapability(4);
        }
      }
    }

    getHighestWarningLevel(warningList){
      let warningLevel = 0;
      for(let i=0; i < warningList.length; i++ ){
        if (warningLevel < this.getWarningLevelByECII(warningList[i].properties.EC_II) ){
          warningLevel = this.getWarningLevelByECII(warningList[i].properties.EC_II);
        }
      }
      return warningLevel;
    }

    getHighestWarningType(warningList){
      let warningLevel = 0;
      let warningType = '';
      for(let i=0; i < warningList.length; i++ ){
        if (warningLevel < this.getWarningLevelByECII(warningList[i].properties.EC_II) ){
          warningLevel = this.getWarningLevelByECII(warningList[i].properties.EC_II);
          warningType = warningList[i].properties.EVENT;
        }
      }
      return warningType;
    }

    /**
     * 
     * @param {*} ecii: EC_II warn event
     * Thsi event id is converted into a warning level 
     */
    getWarningLevelByECII(ecii){
      let ecii_entry = ecii_level.filter(x => (x.ecii == parseInt(ecii)))[0];
      if (ecii_entry && ecii_entry.warninglevel)
      {
        //this.log("Warnlevel: "+ecii+" => "+ecii_entry.warninglevel);
        return ecii_entry.warninglevel;
      }
      else{
        return 0;
      }
    }

    /**
     * 
     * @param {*} id:  ID of warning capability (0 .. 2)
     * This ID is converted into 01 .. 03 for capability name
     */
    async clearWarningCapability(id = 0){
      if (id < 0 || id > 4){
        return;
      }
      id = id + 1;
      let idText = id.toString();
      if (idText.length < 2){
        idText = '0' + idText;
      }
      try{
        this.log("clearWarningCapability() => capability: " + 'warning_'+idText+'_*');
        this.setCapabilityValue('warning_'+idText+'_type', '');
        this.setCapabilityValue('warning_'+idText+'_level', 0);
        this.setCapabilityValue('warning_'+idText+'_period', '');
        this.setCapabilityValue('warning_'+idText+'_description', '');
        this.setCapabilityValue('warning_'+idText+'_msgtype', '');
        this.setCapabilityValue('warning_'+idText+'_group', '');
        this.setCapabilityValue('warning_'+idText+'_severity', '');
        this.setCapabilityValue('warning_'+idText+'_type_ecii', 0);
        this.setCapabilityValue('warning_'+idText+'_parametername', '');
        this.setCapabilityValue('warning_'+idText+'_parametervalue', '');
      }
      catch (error){
        this.log("Error setting capabilities: " + error.message);
      }
    }

    /**
     * 
     * @param {*} id:  ID of warning capability (0 .. 2)
     * This ID is converted into 01 .. 03 for capability name
     */
     async setWarningCapability(id = 0, warning){
      if (id < 0 || id > 4){
        return;
      }
      id = id + 1;
      let idText = id.toString();
      if (idText.length < 2){
        idText = '0' + idText;
      }
      try{
        this.log("setWarningCapability() => capability: " + 'warning_'+idText+'_*');
        this.setCapabilityValue('warning_'+idText+'_type', warning.properties.EVENT);
        this.setCapabilityValue('warning_'+idText+'_level', this.getWarningLevelByECII(warning.properties.EC_II));
        this.setCapabilityValue('warning_'+idText+'_description', warning.properties.DESCRIPTION.substring(0, Math.min(255,warning.properties.DESCRIPTION.length)));
        let from = await this.convertDateToString(new Date(warning.properties.ONSET));                     
        let to = await this.convertDateToString(new Date(warning.properties.EXPIRES));                     
        this.setCapabilityValue('warning_'+idText+'_period', from +' - '+to);
        this.setCapabilityValue('warning_'+idText+'_msgtype', warning.properties.MSGTYPE);
        this.setCapabilityValue('warning_'+idText+'_group', warning.properties.EC_GROUP);
        this.setCapabilityValue('warning_'+idText+'_severity', warning.properties.SEVERITY);
        this.setCapabilityValue('warning_'+idText+'_type_ecii', parseInt(warning.properties.EC_II) );
        this.setCapabilityValue('warning_'+idText+'_parametername', warning.properties.PARAMETERNAME);
        this.setCapabilityValue('warning_'+idText+'_parametervalue', warning.properties.PARAMETERVALUE);

      }
      catch (error){
        this.log("Error setting capabilities: " + error.message);
      }
    }

    async composeMessage(warning, boldText = true){
      let boldParam = '';
      if (boldText){
        boldParam = '**';
      }
      let message = this.homey.__("warning.warningFor") + " " + boldParam + this.getName() + boldParam;
      message = message + " - " + boldParam + warning.properties.HEADLINE + boldParam;
      // message = message + " - " + this.homey.__("warning.warnLevel") + ": " + warning.???;
      message = message + " - "+warning.properties.DESCRIPTION;
      let from = await this.convertDateToString(new Date(warning.properties.ONSET));                     
      let to = await this.convertDateToString(new Date(warning.properties.EXPIRES));                     
      message = message + " - " + this.homey.__("warning.warnPeriod") + ": " + 
                boldParam + from + boldParam +
                " " + this.homey.__("warning.warnPeriodTo") + " " + 
                boldParam + to + boldParam;
      return message;
    }

    async convertDateToString(dateObj){
      const tz  = this.homey.clock.getTimezone();
      const nowTime = dateObj;
      const now = nowTime.toLocaleString('en-US', 
          { 
              hour12: false, 
              timeZone: tz,
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
          });
      let date = now.split(", ")[0];
      date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
      let time = now.split(", ")[1];
      
      let result = date + " " + time;
      return result;
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Warnlocationt has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Warnlocation settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Warnlocation was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.app.events.removeListener("deviceUpdateWarnlocation", this.onDeviceUpdateHandler);
    this.log('Warnlocation has been deleted');
  }
}

module.exports = warnlocationDevice;
