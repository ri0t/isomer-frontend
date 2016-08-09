/*
 * Hackerfleet Operating System
 * =====================================================================
 * Copyright (C) 2011-2016 riot <riot@hackerfleet.org> and others.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import angular from 'angular';
import uirouter from 'angular-ui-router';

import { routing } from './objects.config.js';

import editor from './editor/editor.js';
import list from './list/list.js';

import editortemplate from './editor/editor.tpl.html';
import listtemplate from './list/list.tpl.html';

export default angular
    .module('main.components.objects', [uirouter])
    .config(routing)
    .component('objecteditor', {controller: editor, template: editortemplate, bindings: {schema:'@', uuid:'@', action:'@'}})
    .component('objectlist', {controller: list, template: listtemplate})
    .name;