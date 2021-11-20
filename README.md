# FTC Scorekeeper => vMix Remote
A quick solution to switch inputs in vMix based on which field is currently active

#### Setup
0. Setup an input in vMix that corresponds to each field that you have. Make note of the input numbers.
1. Download the [latest binaries from the release page](https://github.com/Techno11/ftc-vmix-autoav/releases/latest) based on your OS
2. Run the downloaded binary
3. Follow the setup instructions in the launched application
    * **Scorekeeper IP**: IP address of Scorekeeper instance (`localhost` if same PC)
    * **Scorekeeper Port**: Port that the Scorekeeper webapp runs on (`80` is the default from the Scorekeeper)
    * At this point, the app will negotiate and request an API key from the scorekeeping system.  Once requested, it will prompt you to accept the request within the scorekeeping app, which can be done under "Event Admin" => "Manage Server" and at the bottom of that page. Once accepted, you can proceed to the next step.
    * **FTC Event Code**: Event Code of your event within the scorekeeping system
    * **vMix IP**: IP address of computer running vMix
    * **vMix Input Numbers**: Enter in the input # of the coresponding  with the field as prompted. When finished, leave blank.
    * All Done!

#### vMix Troubleshooting
Issues with the app? There are a few troubleshooting steps
* Ensure the API username/password are set to the default, and that the API is enabled:
    * Open settings in the upper right of vMix, and go to "Web Controller" options. Ensure that "Enabled" is checked.
    * In the same window, ensure that the username is "admin" and the set password is also "admin".  If you feel this is a security risk, you can create [an issue](https://github.com/Techno11/ftc-vmix-autoav/issues/new) and there may be an option added in the future.
