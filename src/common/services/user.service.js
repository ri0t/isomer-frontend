/*
 * Isomer - The distributed application framework
 * ==============================================
 * Copyright (C) 2011-2020 Heiko 'riot' Weinen <riot@c-base.org> and others.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Created by riot on 23.02.16.
 */
'use strict';


import loginmodal from '../modals/login.tpl.html';
import useractionmodal from '../modals/user.tpl.html';
import logincontroller from '../component/login-component';


class UserService {

    /*@ngInject*/
    constructor($cookies, $socket, notification, $modal, $rootScope, $location, $state, $timeout, infoscreen,
                fullscreen, $window, systemconfig, gettextCatalog, hotkeys) {
        console.log('UserService constructing');
        this.cookies = $cookies;
        this.socket = $socket;
        this.notification = notification;
        this.modal = $modal;
        this.rootscope = $rootScope;
        this.location = $location;
        this.state = $state;
        this.timeout = $timeout;
        this.infoscreen = infoscreen;
        this.fullscreen = fullscreen;
        this.window = $window;
        this.systemconfig = systemconfig;
        this.gettextCatalog = gettextCatalog;

        this.signedin = false;
        this.signingIn = false;

        this.debug = false;

        this.onAuthCallbacks = [];

        this.username = '';
        this.useruuid = '';

        this.stay_logged_in = false;

        this.desiredcontext = '';

        this.user = {};
        this.profile = {};
        this.clientconfig = {};
        this.clientuuid = '';
        this.clientconfiglist = {};

        this.privacy_enabled = false;
        this.privacy_level = 0;

        this.has_password = true;
        this.errortimeout = null;

        this.language = 'en';

        this.languages = {};

        this.logo_url = '/assets/images/node_logo_colored.svg';
        this.menu_icon_url = '/assets/images/logo32.svg';

        this.mainmenu_visible = true;

        this.login_dialog = null;

        this.colorPickerOptions = {
            showPalette: true,
            color: 'blanchedalmond',
            palette: [
                ['black', 'white', 'blanchedalmond',
                    'rgb(255, 128, 0);', 'hsv 100 70 50'],
                ['red', 'yellow', 'green', 'blue', 'violet']
            ]
        };

        this.embed_external = false;

        this.embed_options = {
            watchEmbedData: true,
            sanitizeHtml: false,
            link: false,
            linkTarget: '_blank',
            code: {
                highlight: false
            },
            Video: {
                embed: this.embed_external
            },
            pdf: {
                embed: this.embed_external
            },
            image: {
                embed: this.embed_external
            },
            audio: {
                embed: this.embed_external
            },
            twitchtvEmbed: this.embed_external,
            dailymotionEmbed: this.embed_external,
            tedEmbed: this.embed_external,
            dotsubEmbed: this.embed_external,
            liveleakEmbed: this.embed_external,
            ustreamEmbed: this.embed_external,
            soundCloudEmbed: this.embed_external,
            spotifyEmbed: this.embed_external,
            tweetEmbed: false, //this.embed_external,
            codepenEmbed: this.embed_external,
            jsfiddleEmbed: this.embed_external,
            jsbinEmbed: this.embed_external,
            plunkerEmbed: this.embed_external,
            githubgistEmbed: this.embed_external,
            ideoneEmbed: this.embed_external
        };


        let self = this;

        self.greet_new_user = function () {
            console.log('[USER] New user registered. Displaying welcome.');
            self.notification.add(
                'success',
                self.gettextCatalog.getString('Registration successful'),
                self.gettextCatalog.getString('<br />Welcome to this Isomer node! Now is a good time to fill out your profile.<br />' +
                    'Click the user button <a href="/#!/editor/profile/' + self.useruuid + '/edit">to edit your profile</a>, ' +
                    'logout or change your password.<br /> <small>Adding some user data will prevent this notification from reappearing.</small>'),
                30
            );
        };

        self.login_failed = function (reason) {
            console.log('[USER] Login failed, displaying warning and resetting.');
            if (reason === null) {
                reason = self.gettextCatalog.getString('Either the username or the supplied password is invalid.');
            }
            self.notification.add('danger', self.gettextCatalog.getString('Login failed'), '<br />' + reason, 10);
            if (this.errortimeout !== null) this.timeout.cancel(this.errortimeout);
            self.logout(true);
        };

        function handleLanguages(msg) {
            if (msg.action === 'getlanguages') {
                console.log('[USER] Got a list of languages:', msg.data);
                self.languages = msg.data;
            }
        }

        function requestLanguages() {
            let request = {
                component: 'isomer.ui.clientmanager.languages',
                action: 'getlanguages'
            };

            self.socket.send(request);
        }

        function checkautologin() {
            let cookie = self.getCookie();
            if (cookie.autologin) {
                self.cookielogin(cookie.uuid);
            }
        }

        function clearlogin() {
            console.log('[USER] Socket has disconnected, clearing session');
            self.logout(true, false);
        }

        function updateclientconfig(ev, uuid, newobj, schema) {
            if (schema !== 'clientconfig') {
                return
            }
            let msg;

            console.log('[USER] Updating client config:', uuid, newobj);

            if (schema === 'clientconfig' && String(uuid) === String(self.clientuuid)) {
                console.log('[USER] Got selected config from OP:', newobj);
                msg = {data: newobj};
                self.storeclientconfigcookie(msg);
            } else if (schema === 'profile' && String(uuid) === String(self.profile.uuid)) {
                console.log('[USER] Got a profile update from OP:', newobj);
                msg = {data: newobj};
                self.storeprofile(msg, true);
            }
        }

        function loginaction(msg) {
            console.log('[USER] Login Action triggered: ', msg);
            if (msg.action === 'login') {
                self.username = msg.data.name;
                self.useruuid = msg.data.uuid;
                self.account = msg.data;

                self.signIn();
            } else if (msg.action === 'new') {
                self.greet_new_user();
            } else if (msg.action === 'fail') {
                self.login_failed(msg.data);
            }
        }

        function store_client_configuration(msg) {
            console.debug('[USER] Got a clientconfig: ', msg.data);
            self.clientconfig = msg.data;

            self.setLanguage(self.clientconfig.language);
            console.debug('[USER] Language set to', self.language);

            self.storeCookie(self.clientconfig.uuid, self.clientconfig.autologin);

            $('#clientname').html('<a href="#!/editor/client/' + self.clientconfig.uuid + '/edit">' + self.clientconfig.name + '</a>');

            if (self.clientconfig.infoscreen) {
                console.log('[USER] Is activated infoscreen, adding rotations');
                self.infoscreen.setRotations(self.clientconfig.infoscreenrotations);
                self.infoscreen.toggleRotations(true);
            } else {
                self.infoscreen.toggleRotations(false);
            }

            if (self.clientconfig.fullscreen) {
                self.fullscreen.all();
                self.fullscreen_enabled = true;
            }
            if (self.clientconfig.hide_menu) {
                self.mainmenu_visible = false;
            }

            self.rootscope.$broadcast('Clientconfig.Update');

        }

        function storeprofile(msg, login) {
            console.log('[USER] Got profile data: ', msg.data);
            self.profile = msg.data;

            $('#btnuser').css('color', '#0f0');
            console.log('[USER] Profile: ', self.profile, self);

            self.changeCurrentTheme();

            if (typeof login === 'undefined' && (Object.keys(self.profile.userdata).length === 0 && self.profile.userdata.constructor === Object)) {
                self.greet_new_user();
            }

            console.log('[USER] Emitting update');

            self.rootscope.$broadcast('Profile.Update');
        }


        this.get_module_default = function (key) {
            console.log('[USER] Getting settings for:', key);

            let result = this.clientconfig.modules[key];

            console.debug('[TODO] Clientconfig value: ', result);

            if (result === '' || typeof result === 'undefined') {
                console.debug('[TODO] Picking user profile setting', self.profile);
                result = this.profile.modules[key];
            }
            if (result === '' || typeof result === 'undefined') {
                console.debug('[TODO] Picking system profile setting', self.profile);
                result = self.systemconfig.config.modules[key];
            }
            console.log('[TODO] Final setting: ', result);

            return result
        };


        self.storeprofile = storeprofile;
        self.storeclientconfigcookie = store_client_configuration;

        hotkeys.add({
            combo: 'alt+u',
            description: 'Open user actions',
            callback: function () {
                self.login();
            }
        });
        hotkeys.add({
            combo: 'ctrl+alt+d',
            callback: function () {
                self.debug = !self.debug;
            }
        });

        this.socket.listen('isomer.ui.clientmanager.languages', handleLanguages);
        this.socket.listen('auth', loginaction);
        this.socket.listen('profile', storeprofile);
        this.socket.listen('clientconfig', store_client_configuration);

        this.rootscope.$on('Client.Connect', checkautologin);
        this.rootscope.$on('Client.Connect', requestLanguages);
        this.rootscope.$on('Client.Disconnect', clearlogin);
        this.rootscope.$on('Client.Connectionloss', clearlogin);

        this.rootscope.$on('OP.Get', updateclientconfig);
        this.rootscope.$on('OP.Update', updateclientconfig);

        console.log('UserService constructed');
    }


    fullscreentoggle() {
        if (this.fullscreen.isEnabled()) {
            this.fullscreen.cancel();
            this.fullscreen_enabled = false;
        } else {
            this.fullscreen.all();
            this.fullscreen_enabled = true;
        }
    }

    addinfoscreen(delay) {
        console.log('Would now append new state:', this.state);
        let args = [];

        for (let prop in this.state.params) {
            if (this.state.params.hasOwnProperty(prop)) {
                args.push({name: prop, value: this.state.params[prop]});
            }
        }
        console.log('got args');
        let statename = this.state.current.name;
        statename = statename.replace('app.', '');
        console.log('replaced args');
        let rotation = {
            'state': statename,
            'duration': delay,
            'args': args
        };
        this.clientconfig.infoscreenrotations.push(rotation);
        console.log('ROTATIONS:', this.clientconfig.infoscreenrotations);
        this.saveClientconfig();

    }

    logout(force, notify) {
        if (this.socket.connected === true || force === true) {
            console.log('[USER] Logout triggered.');
            if (notify === true) {
                console.log('[USER] Trying to logout.');
                let authpacket = {component: 'auth', action: 'logout'};
                this.socket.send(authpacket);

                this.location.url('');
                this.window.location.reload();
                //this.state.go(this.state.current.name, this.state.params, { reload: true });
            }

            this.profile = {};
            this.clientconfig = {};
            this.user = {};
            this.signedin = false;
            this.signingIn = false;
        } else {
            console.log('[USER] Cannot logout - not connected.');
        }
    }

    onAuth(callback) {
        if (typeof callback !== 'function') {
            throw new Error('[USER] Callback must be a function');
        }

        this.onAuthCallbacks.push(callback);
    }

    login(username, password) {
        console.log('[USER] Service Login triggered');
        if (this.signedin === true) {
            console.log('[USER] Already logged in. Showing Profile.');
            this.showuseractions();
        } else {
            if (typeof (username) === 'undefined') {
                console.log('[USER] No username given, showing login dialog.');

                this.showlogin();
            } else {
                this.dologin(username, password);
                if (this.login_dialog !== null) this.login_dialog.hide();
            }
        }
    }

    dologin(username, password) {
        console.log(this.socket);
        if (this.socket.connected === true) {
            console.log('[USER] Trying to login.');
            let cookie = this.getCookie();
            let uuid = cookie.uuid;
            console.log('[USER] Client cookie: ', cookie);

            let authpacket = {
                'component': 'auth', 'action': 'login',
                'data': {
                    'username': username,
                    'password': password,
                    'clientuuid': uuid
                }
            };

            this.socket.send(authpacket);
            let self = this;

            this.errortimeout = this.timeout(function () {
                if (self.signingIn === true) {
                    self.signinIn = false;
                    self.login_failed(self.gettextCatalog.getString('No response from node within 30 seconds!'));
                }
            }, 30000);

        } else {
            console.log('[USER] Not connected, cannot login.');
        }
    }


    signIn() {
        this.signedin = true;
        this.signingIn = false;

        this.rootscope.has_password = true;
        this.has_password = true;
        this.rootscope.logged_in = true;

        if (this.errortimeout !== null) this.timeout.cancel(this.errortimeout);

        if (this.rootscope.has_password === false && this.rootscope.logged_in === true) {
            console.log('Redirecting to new password entry');
            this.state.go('app.password');
        }

        for (let i = 0; i < this.onAuthCallbacks.length; i++) {
            console.log('[USER] Running auth callback.');
            this.onAuthCallbacks[i].call(this.username);
        }

        $('#btnuser').css('color', '#ff0');
        //$('#nav-dashboard, #nav-logbook, #nav-settings').removeClass('hidden');
        //$('#nav-crew', '#nav-switchboard').removeClass('hidden');

        this.rootscope.$broadcast('User.Login');

        if (this.desiredcontext !== false) {
            console.log('[USER] Reloading to page ', this.desiredcontext);
            // TODO: Make this work again, with states etc
            //location.url(desiredcontext);
            //rootscope.apply();
        }
        //this.$route.reload();

    }

    set_privacy(new_level) {
        console.log('[USER] Adjusting privacy to:', new_level);
    }

    showprofile() {
        this.state.go('app.editor', {
            schema: 'profile',
            action: 'edit',
            'uuid': this.profile.uuid
        });
    }

    changePassword() {
        // TODO: Check if state is installed via enrol module
        this.state.go('app.password');
    }

    showlogin() {
        if (this.signingIn !== true) {
            let self = this;

            this.login_dialog = this.modal({
                template: loginmodal,
                controller: logincontroller,
                controllerAs: '$ctrl',
                title: self.gettextCatalog.getString('Login to this node'),
                keyboard: false,
                id: 'loginDialog',
                backdrop: 'static'
            });

            this.signingIn = true;
        }
    }

    showuseractions() {
        if (this.signingIn !== true) {
            let self = this;

            this.modal({
                template: useractionmodal,
                controller: logincontroller,
                controllerAs: '$ctrl',
                title: self.gettextCatalog.getString('User actions'),
                id: 'useractionDialog'
            });
        }
    }

    cookielogin(uuid) {
        console.log('[USER] Auto-logging in...');
        let authpacket = {component: 'auth', action: 'autologin', data: uuid};
        let self = this;
        this.timeout(function () {
            console.log('[USER] Transmitting autologin.');
            self.socket.send(authpacket);
        }, 500);
    }

    storeCookie(newuuid, autologin) {
        console.log('[USER] Storing configuration UUID cookie:', newuuid, autologin);
        this.clientuuid = newuuid;
        this.cookies.putObject('isomer-client', {uuid: newuuid, autologin: autologin});
    }

    getCookie() {
        let cookie = this.cookies.get('isomer-client');

        if (typeof cookie === 'undefined') {
            cookie = "";
        } else {
            cookie = JSON.parse(cookie);
        }

        return cookie;
    }

    changeCurrentTheme(newTheme) {
        // TODO: Better check for unset theme or better unsetting
        console.log('[USER] Setting new theme');
        if ((typeof newTheme !== 'undefined') && (newTheme.length > 5)) {
            console.log('[USER] Switching to theme ', newTheme);
            $('#BootstrapTheme').attr('href', 'bower_components/' + newTheme + 'bootstrap-theme.css');
            $('#Bootstrap').attr('href', 'bower_components/' + newTheme + 'bootstrap.css');
        } else {
            console.log('[USER] Not switching to undefined theme.');
        }
    }

    setLanguage(token) {
        console.log('[USER] Setting client to language:', token);
        this.language = token;

        let self = this;

        self.gettextCatalog.setCurrentLanguage(token);
        self.gettextCatalog.loadRemote("/l10n/frontend." + token + ".json");

        let request = {
            component: 'isomer.ui.clientmanager.languages',
            action: 'selectlanguage',
            data: token
        };

        this.socket.send(request);
    }

    logincancel() {
        console.log('[USER] Login cancelled');
        if (this.login_dialog !== null) this.login_dialog.hide();
        this.signingIn = false;
    }

    saveProfile() {
        console.log('[USER] Storing user profile on node');
        this.socket.send({
            'component': 'isomer.events.objectmanager',
            'action': 'put',
            'data': {'schema': 'profile', 'obj': this.profile}
        });
    }

    saveClientconfig() {
        console.log('[USER] Storing client config on node');
        this.socket.send({
            'component': 'isomer.events.objectmanager',
            'action': 'put',
            'data': {'schema': 'client', 'obj': this.clientconfig}
        });
    }

    switchClientconfig(uuid) {
        console.log('[USER] Loading client config from node');
        this.clientuuid = uuid;
        this.socket.send({
            'component': 'isomer.events.objectmanager',
            'action': 'get',
            'data': {'schema': 'client', 'uuid': this.clientuuid}
        });
    }

    updateclientconfig(data) {
        this.clientconfig = data;
        // TODO: Validate with schema from newly built schemaservice
        console.log('[USER] Updating client configuration with ', this.clientconfig);
        this.saveClientconfig();

        this.rootscope.$broadcast('Clientconfig.Update');
    }


    getModuleDefault(thing) {
        console.log('[USER] Getting configured default value:', thing);

        console.log('[USER] Module sections:', this.clientconfig, this.profile, this.systemconfig.config);

        let data;

        try {
            data = this.clientconfig.modules[thing];
        } catch (e) {
            console.debug('No clientconfig default:', this.clientconfig.modules);
        }

        if (typeof data === 'undefined') {
            try {
                data = this.profile.modules[thing];
            } catch (e) {
                console.debug('No profile default:', this.profile.modules);
            }
        }

        if (typeof data === 'undefined') {
            try {
                data = this.systemconfig.config.modules[thing];
            } catch (e) {
                console.log('Could not find a default value:', this.systemconfig.config.modules);
                data = null;
            }
        }

        console.log('[USER] Default value for ', thing, ':', data);
        return data;
    }


}


UserService.$inject = ['$cookies', 'socket', 'notification', '$modal', '$rootScope', '$location', '$state', '$timeout',
    'infoscreen', 'Fullscreen', '$window', 'systemconfig', 'gettextCatalog', 'hotkeys'];

export default UserService;
