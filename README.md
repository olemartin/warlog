Warbot Clash Royale Discord Bot
================
This lambda posts data about your war games in you Clash Royale clan to a Discord Web Hook. Integrates with RoyaleApi.comi, Cloudinary, is.gd and Discord.
Set the lambda to for instance run every 15 minutes.

Steps to install and configure this Discord Bot:
-----------

**1.** Clone this git repository.

**2.** Set up AWS cli on your local machine. Use the following guides to accomplish that:
	[Install the AWS Command Line Interface on Linux](https://docs.aws.amazon.com/cli/latest/userguide/awscli-install-linux.html)
	[Install the AWS Command Line Interface on Microsoft Windows](https://docs.aws.amazon.com/cli/latest/userguide/awscli-install-windows.html)
	[Install the AWS Command Line Interface on macOS](https://docs.aws.amazon.com/cli/latest/userguide/cli-install-macos.html)

**3.** Install Node Package Manager (NPM) and install on your machine: https://nodejs.org/en/

**4.** Create a Cloudinary account: https://cloudinary.com/

		Keep track of your Cloudinary Cloud Name, Cloudinary API Key, and Cloudinary API Secret.
		You will use these in step 14.

**5.** Generate a discord webhook. Keep record of the string after "https://discordapp.com/api/webhooks/"
	
		When you create a discord webhook it will give you something like this: https://discordapp.com/api/webhooks/464491015357595669/uT9-nZZi1R13kCM6a_oc-D3gF32raBoAP1A67r2KsgDvKMxXz2I4kqGHx31DLRsNd4d0
		All you need to copy down for this tutorial is "464491015357595669/uT9-nZZi1R13kCM6a_oc-D3gF32raBoAP1A67r2KsgDvKMxXz2I4kqGHx31DLRsNd4d0"
		You will use this string in step 12 and is the discord_key value.
		![How to create a webhook in Discord](https://i.imgur.com/5kLNjui.gif)
	
**6.** In Cloudinary, you will need to click on "Media Library" then create a new folder called "CR".

**7.** Download the card repository from the Royale API github: https://github.com/RoyaleAPI/cr-api-assets/archive/master.zip (you only need the "cards" folder)

**8.** Upload the contents of the "cards" folder to your CR folder in Cloudinary.

		![Images in the CR folder in Cloudinary](https://i.imgur.com/gvzPR4G.png)

**9.**  On Line 8 of "warlog.js" enter in your own cloudinary key after it says "cloud_name:"

**10.** On line 76 of "warlog.js" correct the time zone to your time zone according to Moment Timezone documentation (http://momentjs.com/timezone)

		The default time zone will be Norwegian Locale. If you are central time you need to change it. Example: .tz('America/Chicago')
		
**11.** On line 2 of "example-event.json" edit the clan_id field with your own clan ID

**12.** On line 3 of "example-event.json" edit the existing discord_key to match the string created in the "Generate discord webhook" step.

**13.** Install ClaudiaJS: https://claudiajs.com/tutorials/installing.html

	You should only really need to run "npm install claudia -g" to have it working.
	
**14.** You need to have a RoyaleAPI key handy. If you do not have a RoyaleAPI key, please get one by joining the RoyaleAPI Discord: http://discord.me/RoyaleAPI

	Go to the developer-key section and then enter "?crapikey get" in the chat. A bot should message you with your API key. Do not share this with anyone!

The handler will be warlog.handler. A handler is The module-name.export value in your function. For example, "warlog.handler" would call exports.handler in warlog.js.

You only need to run 2 commands to start using the bot. You will need to be in the warlog directory on your machine when executing these commands.
![Correct Directory](https://i.imgur.com/FZX1TH6.png)


**15.** Command #1:
```
claudia create --region us-east-1 --handler warlog.handler --timeout 30 --set-env CLOUDINARY_KEY={ENTERKEYHERE},CLOUDINARY_SECRET_KEY={ENTERKEYHERE},ROYALE_API_KEY={ENTERAPIKEYHERE}
```

	example:
	claudia create --region us-east-1 --handler warlog.handler --timeout 30 --set-env CLOUDINARY_KEY=9541254654897,CLOUDINARY_SECRET_KEY=fd_3kanb-JghekD-843Njkdf,ROYALE_API_KEY=eyDClMJtZCKlmNOPqrStuv.WXyzadBNBdEs
	
	You can find the AWS region closest to you by viewing this documentation: https://docs.aws.amazon.com/general/latest/gr/rande.html
	
	Example if you would like to execute this in paris region:
	claudia create --region eu-west-3 --handler warlog.handler --timeout 30 --set-env CLOUDINARY_KEY=9541254654897,CLOUDINARY_SECRET_KEY=fd_3kanb-JghekD-843Njkdf,ROYALE_API_KEY=eyDClMJtZCKlmNOPqrStuv.WXyzadBNBdEs


**16.** Command #2:
```
claudia add-scheduled-event --event example-event.json --name warlog-timed-execution --schedule "rate(15 minutes)"
```

**17.** Open up the example-event.json and enter that into the test parameters.
![How to create test parameter](https://i.imgur.com/dTczxf1.gif)