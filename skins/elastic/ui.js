/**
 * Roundcube functions for the elastic skin
 *
 * Copyright (c) 2017, The Roundcube Dev Team
 *
 * The contents are subject to the Creative Commons Attribution-ShareAlike
 * License. It is allowed to copy, distribute, transmit and to adapt the work
 * by keeping credits to the original autors in the README file.
 * See http://creativecommons.org/licenses/by-sa/3.0/ for details.
 *
 * @license magnet:?xt=urn:btih:90dc5c0be029de84e523b9b3922520e79e0e6f08&dn=cc0.txt CC0-1.0
 */

"use strict";

function rcube_elastic_ui()
{
    var ref = this,
        mode = 'normal', // one of: wide, normal, tablet, phone
        env = {
            config: {
                standard_windows: rcmail.env.standard_windows,
                message_extwin: rcmail.env.message_extwin,
                compose_extwin: rcmail.env.compose_extwin
            },
            small_screen_config: {
                standard_windows: true,
                message_extwin: false,
                compose_extwin: false
            }
        },
        content_buttons = [],
        layout = {
            menu: $('#layout > .menu'),
            sidebar: $('#layout > .sidebar'),
            list: $('#layout > .list'),
            content: $('#layout > .content'),
        },
        buttons = {
            menu: $('a.menu-button'),
            back_sidebar: $('a.back-sidebar-button'),
            back_list: $('a.back-list-button'),
        };


    // Public methods
    this.register_frame_buttons = register_frame_buttons;
    this.about_dialog = about_dialog;
    this.spellmenu = spellmenu;
    this.searchmenu = searchmenu;
    this.attachmentmenu = attachmentmenu;


    // Initialize layout
    layout_init();

    // Convert some elements to Bootstrap style
    bootstrap_style();

    // Initialize responsive toolbars (have to be before popups init)
    toolbar_init();

    // Initialize content frame and list handlers
    content_frame_init();

    // Initialize menu dropdowns
    dropdowns_init();

    // Update layout after initialization
    resize();

    // Setup various UI elements
    setup();


    /**
     * Setup procedure
     */
    function setup()
    {
        // Initialize search forms (in list headers)
        $('.header > .searchbar').each(function() { searchbar_init(this); });

        // Intercept jQuery-UI dialogs to re-style them
        if ($.ui) {
            $.widget('ui.dialog', $.ui.dialog, {
                open: function() {
                    this._super();
                    dialog_open(this);
                    return this;
                }
            });
        }

        // menu/sidebar/list button
        buttons.menu.on('click', function() { show_menu(); return false; });
        buttons.back_sidebar.on('click', function() { show_sidebar(); return false; });
        buttons.back_list.on('click', function() { show_list(); return false; });

        $('body').on('click', function() { if (mode == 'phone') layout.menu.hide(); });

        // Set content frame title in parent window
        if (rcmail.is_framed()) {
            var title = $('h1.voice:first').text();
            if (title) {
                parent.$('#content > .header > .header-title').text(title);
            }
        }
        else {
            var title = $('#content .boxtitle:first').detach().text();
            if (title) {
                $('#content > .header > .header-title').text(title);
            }
        }

        // Move form buttons from the content frame into the frame header (on parent window)
        // TODO: Active button state
        var form_buttons = [];
        $('.formbuttons').children(':not(.cancel)').each(function() {
            var target = $(this);

            // skip non-content buttons
            if (!rcmail.is_framed() && !target.parents('.content').length) {
                return;
            }

            var button = target.clone();

            form_buttons.push(
                button.attr({'onclick': '', disabled: false, id: button.attr('id') + '-clone', title: target.text()})
                    .data('target', target)
                    .on('click', function(e) { target.click(); })
                    .text('')
            );
        });

        if (form_buttons.length) {
            if (rcmail.is_framed()) {
                if (parent.UI) {
                    parent.UI.register_frame_buttons(form_buttons);
                }
            }
            else {
                register_frame_buttons(form_buttons);
            }
        }
    };

    /**
     * Moves form buttons into content frame toolbar (for mobile)
     */
    function register_frame_buttons(buttons)
    {
        // we need these buttons really only in phone mode
        if (/*mode == 'phone' && */layout.content.length && buttons && buttons.length) {
            var header = layout.content.children('.header');

            if (header.length) {
                var toolbar = header.children('.buttons');

                if (!toolbar.length) {
                    var menu = $('a.toolbar-menu-button', header);
                    toolbar = $('<span class="buttons">');

                    if (menu.length) {
                        menu.before(toolbar);
                    }
                    else {
                        toolbar.appendTo(header);
                    }
                }

                content_buttons = [];
                $.each(buttons, function() {
                    content_buttons.push(this.data('target'));
                });

                toolbar.html('').append(buttons);
                resize();
            }
        }
    };

    /**
     * Setup environment
     */
    function layout_init()
    {
        // Select current layout element
        env.last_selected = $('#layout > div.selected')[0];
        if (!env.last_selected && layout.content.length) {
            $.each(['sidebar', 'list', 'content'], function() {
                if (layout[this].length) {
                    env.last_selected = layout[this][0];
                    layout[this].addClass('selected');
                    return false;
                }
            });
        }

        // Register resize handler, and call it to do layout setup
        $(window).on('resize', function() {
            clearTimeout(env.resize_timeout);
            env.resize_timeout = setTimeout(function() { resize(); }, 25);
        });

        rcmail
            .addEventListener('message', message_displayed)
            .addEventListener('menu-open', menu_toggle)
            .addEventListener('menu-close', menu_toggle)
            .addEventListener('editor-init', tinymce_init)
            .addEventListener('autocomplete_create', rcmail_popup_init)
            .addEventListener('googiespell_create', rcmail_popup_init)
            .addEventListener('init', init);
    };

    /**
     * rcmail 'init' event handler
     */
    function init()
    {
        // Enable checkbox selection on list widgets
        $('table[data-list]').each(function() {
            var list = $(this).data('list');
            if (rcmail[list] && rcmail[list].multiselect) {
                rcmail[list].checkbox_selection = true;
            }
        });

        // add menu link for each attachment
        $('#attachment-list > li').each(function() {
            attachmentmenu_append(this);
        });

        rcmail.addEventListener('fileappended', function(e) { if (e.attachment.complete) attachmentmenu_append(e.item); });
    };

    /**
     * Apply bootstrap classes to html elements
     */
    function bootstrap_style(context)
    {
        $('input.button,button', context || document).addClass('btn').not('.btn-primary,.primary,.mainaction').addClass('btn-secondary');
        $('input.button.mainaction,button.primary,button.mainaction', context || document).addClass('btn-primary');

        $.each(['warning', 'error'], function() {
            var type = this;
            $('.box' + type, context).each(function() {
                message_displayed({object: this, type: type});
            });
        });
    };

    /**
     * Initializes popup menus
     */
    function dropdowns_init()
    {
        $('*[data-popup]').each(function() { popup_init(this); });

        // close popups on click in an iframe on the page
        var close_all_popups = function(e) {
            $('.popover-content:visible').each(function() {
                var button = $(this).children('*:first').data('button');
                if (e.target != button) {
                    $(button).popover('hide');
                }
            });
        };

        // TODO: Fix unwanted popups closing on click inside a popup
        $(document).on('click', close_all_popups);
        rcube_webmail.set_iframe_events({mousedown: close_all_popups});
    };

    /**
     * Init content frame
     */
    function content_frame_init()
    {
        // when loading content-frame in small-screen mode display it
        layout.content.find('iframe').on('load', function(e) {
            var show = !e.target.contentWindow.location.href.endsWith(rcmail.env.blankpage);

            if (show && !layout.content.is(':visible')) {
                env.last_selected = layout.content[0];
                screen_resize();
            }
            else if (!show) {
                $('.header > .header-title', layout.content).text('');
            }
        });

        // display the list widget after 'list' and 'listgroup' commands
        // @TODO: plugins should be able to do the same
        var list_handler = function(e) {
            if (mode != 'wide') {
                if (rcmail.env.task == 'addressbook' || (rcmail.env.task == 'mail' && !rcmail.env.action)) {
                    show_list();
                }
            }

            // display current folder name in list header
            if (rcmail.env.task == 'mail' && !rcmail.env.action) {
                var name = $.type(e) == 'string' ? e : rcmail.env.mailbox;
                var folder = rcmail.env.mailboxes[name];
                $('.header > .header-title', layout.list).text(folder ? folder.name : '');
            }
        };

        rcmail
            .addEventListener('afterlist', list_handler)
            .addEventListener('afterlistgroup', list_handler)
            .addEventListener('afterlistsearch', list_handler);
    };

    /**
     * Handler for editor-init event
     */
    function tinymce_init(o)
    {
        // FIXME: only for mobile?
        if (mode == 'phone') {
            // Enable autoresize plugin
            // TODO: autoresize for plain text editor area
            o.config.plugins += ' autoresize';

            // Make the toolbar icons bigger
            o.config.toolbar_items_size = null;

            // Use minimalistic toolbar
            o.config.toolbar = 'undo redo | insert | styleselect';
        }
    };

    /**
     * Handler for some Roundcube core popups
     */
    function rcmail_popup_init(o)
    {
        // Add some common styling to the autocomplete/googiespell popups
        $('table,ul', o.obj).addClass('listing iconized');
        $(o.obj).addClass('popupmenu');
        bootstrap_style(o.obj);
    };

    /**
     * Window resize handler
     * Does layout reflows e.g. on screen orientation change
     */
    function resize()
    {
        var size, width = $(window).width();

        if (width <= 480)
            size = 'phone';
        else if (width > 1200)
            size = 'wide';
        else if (width <= 768)
            size = 'tablet';
        else
            size = 'normal';

        mode = size;
        screen_resize();
        display_screen_size(); // debug info
    };

    // for development only (to be removed)
    function display_screen_size()
    {
        if ($('body.iframe').length)
            return;

        var div = $('#screen-size'), win = $(window);
        if (!div.length) {
            div = $('<div>').attr({
                id: 'screen-size',
                style: 'position:absolute;display:block;right:0;z-index:100;'
                    + (rcmail.is_framed() ? 'top:0;' : 'bottom:0;')
                    + 'opacity:0.5;color:white;background-color:black;white-space:nowrap'
            }).appendTo(document.body);
        }

        div.text(win.width() + ' x ' + win.height() + ' (' + mode + ')');
    };

    function screen_resize()
    {
        switch (mode) {
            case 'phone': screen_resize_phone(); break;
            case 'tablet': screen_resize_tablet(); break;
            case 'normal': screen_resize_normal(); break;
            case 'wide': screen_resize_wide(); break;
        }
    };

    function screen_resize_phone()
    {
        screen_resize_small();

        layout.menu.hide();
    };

    function screen_resize_tablet()
    {
        screen_resize_small();

        layout.menu.css('display', 'flex');
    };

    function screen_resize_small()
    {
        var show, got_content = false;

        if (layout.content.length) {
            show = got_content = layout.content.is(env.last_selected);

            layout.content.css('display', show ? 'flex' : 'none');
        }

        if (layout.list.length) {
            show = !got_content && layout.list.is(env.last_selected);
            layout.list.css('display', show ? 'flex' : 'none');
        }

        if (layout.sidebar.length) {
            show = !got_content && (layout.sidebar.is(env.last_selected) || !layout.list.length);
            layout.sidebar.css('display', show ? 'flex' : 'none');
        }

        if (got_content) {
            buttons.back_list.show();
        }

        $('.header > ul.toolbar', layout.content).addClass('popupmenu');

        $.each(content_buttons, function() { $(this).hide(); });

        // disable ext-windows and other features
        rcmail.set_env(env.small_screen_config);
        rcmail.enable_command('extwin', false);
    };

    function screen_resize_normal()
    {
        var show;

        if (layout.list.length) {
            show = layout.list.is(env.last_selected) || !layout.sidebar.is(env.last_selected);
            layout.list.css('display', show ? 'flex' : 'none');
        }
        if (layout.sidebar.length) {
            show = !layout.list.length || layout.sidebar.is(env.last_selected);
            layout.sidebar.css('display', show ? 'flex' : 'none');
        }

        layout.content.css('display', 'flex');
        layout.menu.css('display', 'flex');
        buttons.back_list.hide();
        $.each(content_buttons, function() { $(this).show(); });
        $('ul.toolbar.popupmenu').removeClass('popupmenu');

        // re-enable ext-windows
        rcmail.set_env(env.config);
        rcmail.enable_command('extwin', true);
    };

    function screen_resize_wide()
    {
        $.each(layout, function(name, item) { item.css('display', 'flex'); });
        buttons.back_list.hide();
        $.each(content_buttons, function() { $(this).show(); });
        $('ul.toolbar.popupmenu').removeClass('popupmenu');

        // re-enable ext-windows
        rcmail.set_env(env.config);
        rcmail.enable_command('extwin', true);
    };

    function show_sidebar()
    {
        // show sidebar and hide list
        layout.list.hide();
        layout.sidebar.css('display', 'flex');
    };

    function show_list()
    {
        if (!layout.list.length && !layout.sidebar.length) {
            history.back();
        }
        else {
            // show list and hide sidebar and content
            layout.sidebar.hide();
            layout.list.css('display', 'flex');
            hide_content();
        }
    };

    function hide_content()
    {
        // show sidebar or list, hide content frame
        //$(layout.content).hide();
        env.last_selected = layout.list[0] || layout.sidebar[0];
        screen_resize();

        // reset content frame, so we can load it again
        rcmail.show_contentframe(false);

        // now we have to unselect selected row on the list
        $('[data-list]', layout.list).each(function() {
            var list = $(this).data('list');
            if (rcmail[list]) {
                if (rcmail[list].clear_selection) {
                    rcmail[list].clear_selection(); // list widget
                }
                else if (rcmail[list].select) {
                    rcmail[list].select(); // treelist widget
                }
            }
        });
    };

    // show menu widget
    function show_menu()
    {
        var display = 'flex';

        if (mode == 'phone') {
            display = layout.menu.is(':visible') ? 'none' : 'block';
        }

        layout.menu.css('display', display);
    };

    /**
     * Triggered when a UI message is displayed
     */
    function message_displayed(p)
    {
        var cl, classes = 'ui alert',
            map = {
                information: 'alert-success',
                confirmation: 'alert-success',
                notice: 'alert-info',
                error: 'alert-danger',
                warning: 'alert-warning',
                loading: 'alert-info loading'
            };

        if (cl = map[p.type]) {
            classes += ' ' + cl;
            $('<i>').attr('class', 'icon').prependTo(p.object);
        }

        $(p.object).addClass(classes).attr('role', 'alert');
        $('a', p.object).addClass('alert-link');
/*
        var siblings = $(p.object).siblings('div');
        if (siblings.length)
            $(p.object).insertBefore(siblings.first());

        // show a popup dialog on errors
        if (p.type == 'error' && rcmail.env.task != 'login') {
            // hide original message object, we don't want both
            rcmail.hide_message(p.object);
        }
*/
    };

    /**
     * Initializes searchbar widget
     */
    function searchbar_init(bar)
    {
        var input = $('input', bar),
            button = $('a.button.search', bar),
            settings_button = $('a.button.settings', bar)[0],
            form = $('form', bar),
            all_elements = $('form, a.button.options, a.button.reset', bar),
            is_search_pending = function() {
                // TODO: This have to be improved to detect real searching state
                //       There are cases when search is active but the input is empty
                return input.val();
            },
            hide_func = function(event, focus) {
                // TODO: This animation in Chrome does not look as good as in Firefox
                $(bar).animate({'width': '0'}, 200, 'swing', function() {
                    all_elements.hide();
                    $(bar).width('auto'); // fixes search button position in Chrome
                    button[is_search_pending() ? 'addClass' : 'removeClass']('active')
                        .css('display', 'block');
                    if (focus) {
                        button.focus();
                    }
                });
            };

        if (is_search_pending()) {
            button.addClass('active');
        }

        // Display search form (with animation effect)
        button.on('click', function() {
            $(bar).animate({'width': '100%'}, 200);
            all_elements.css('display', 'table-cell');
            button.hide();
            input.focus();
        });

        // Search reset action
        $('a.button.reset', bar).on('click', function(e) {
            // for treelist widget's search setting val and keyup.treelist is needed
            // in normal search form reset-search command will do the trick
            // TODO: This calls for some generalization, what about two searchboxes on a page?
            input.val('').change().trigger('keyup.treelist', {keyCode: 27});
            hide_func(e, true);
        });

        // These will hide the form, but not reset it
        rcube_webmail.set_iframe_events({mousedown: hide_func});
        $('body').on('mousedown', function(e) {
            if (!button.is(':visible') && $.inArray(bar, $(e.target).parents()) == -1) {
                hide_func(e);
            }
        });
    };

    /**
     * Converts toolbar menu into popup-menu for small screens
     */
    function toolbar_init()
    {
        if (env.got_smart_toolbar) {
            return;
        }

        env.got_smart_toolbar = true;

        // TODO: if the toolbar contains "global or list only" buttons
        //       another popup menu with these options should be created
        //       on the list (or sidebar if there's no list element).
        // TODO: spacer item
        // TODO: dropbutton item
        // TODO: a way to inject buttons to the menu from content iframe
        //       or automatically add all buttons except Save and Cancel
        //       (example QR Code button in contact frame)

        var items = [];

        // convert toolbar to a popup list
        $('.header > .toolbar', layout.content).each(function() {
            var toolbar = $(this);

            toolbar.children().each(function() {
                var button = $(this).detach();
                items.push($('<li role="menuitem">').append(button));
            });

            toolbar.remove();
        });

        // append the new toolbar and menu button
        if (items.length) {
            var menu_button = $('<a class="button icon toolbar-menu-button" href="#menu">')
                .attr({'data-popup': 'toolbar-menu'});

            layout.content.children('.header')
                // TODO: copy original toolbar attributes (class, role, aria-*)
                .append($('<ul>').attr({'class': 'toolbar popupmenu listing', id: 'toolbar-menu'}).append(items))
                .append(menu_button);

            // TODO: A menu converted to a popup will be hidden on click in the body
            //       we do not want that
        }
    };

    /**
     * Initialize a popup for specified button element
     */
    function popup_init(item)
    {
        var popup_id = $(item).data('popup'),
            popup = $('#' + popup_id)[0],
            title = $(item).attr('title'),
            popup_position = $(item).data('popup-pos') || 'bottom';

        $(item).attr({
                'aria-haspopup': 'true',
                'aria-expanded': 'false',
                'aria-owns': popup_id
            })
            .popover({
                trigger: 'click',
                container: 'body',
                content: popup,
                placement: popup_position,
                html: true
            })
            .on('show.bs.popover', function(event) {
                var init_func = $(popup).data('popup-init');

                $(popup).attr('aria-hidden', false);

                if (init_func && ref[init_func]) {
                    ref[init_func](popup, item, event);
                }
                else if (init_func && window[init_func]) {
                    window[init_func](popup, item, event);
                }
            })
            .on('hide.bs.popover', function() {
                $(popup).attr('aria-hidden', true);
            })
            .attr('title', title); // re-add title attribute removed by bootstrap

        // TODO: Fix popup positioning
        // TODO: Set popup height so it is less than the window height
        $(popup).attr('aria-hidden', 'true')
            .data('button', item);
    };

    /**
     * Set UI dialogs size/style depending on screen size
     */
    function dialog_open(dialog)
    {
        var me = $(dialog.uiDialog),
            width = me.width(),
            height = me.height(),
            maxWidth = $(window).width(),
            maxHeight = $(window).height();

        if (maxWidth <= 480) {
            me.css({width: '100%', height: '100%'});
        }
        else {
            if (height > maxHeight) {
                me.css('height', '100%');
            }
            if (width > maxWidth) {
                me.css('width', '100%');
            }
        }

        // TODO: style buttons/forms
        bootstrap_style(dialog.uiDialog);
    };

    /**
     * Handler for menu-open and menu-close events
     */
    function menu_toggle(p)
    {
        if (p && p.name == 'messagelistmenu') {
            menu_messagelist(p);
        }
        else if (p && p.name == 'folder-selector') {
            $('ul:first', p.obj).addClass('listing folderlist');
//            $(p.obj).addClass('popupmenu');
        }
    };

    /**
     * Messages list options dialog
     */
    function menu_messagelist(p)
    {
        var content = $('#listoptions-menu'),
            width = content.width() + 25,
            dialog = content.clone();

        // set form values
        $('input[name="sort_col"][value="'+rcmail.env.sort_col+'"]', dialog).prop('checked', true);
        $('input[name="sort_ord"][value="DESC"]', dialog).prop('checked', rcmail.env.sort_order == 'DESC');
        $('input[name="sort_ord"][value="ASC"]', dialog).prop('checked', rcmail.env.sort_order != 'DESC');

        // set checkboxes
        $('input[name="list_col[]"]', dialog).each(function() {
            $(this).prop('checked', $.inArray(this.value, rcmail.env.listcols) != -1);
        });

        var save_func = function(e) {
            if (rcube_event.is_keyboard(e.originalEvent)) {
                $('#listmenulink').focus();
            }

            var sort = $('input[name="sort_col"]:checked', dialog).val(),
                ord = $('input[name="sort_ord"]:checked', dialog).val(),
                layout = $('input[name="layout"]:checked', dialog).val(),
                cols = $('input[name="list_col[]"]:checked', dialog)
                    .map(function() { return this.value; }).get();

            rcmail.set_list_options(cols, sort, ord, rcmail.env.threading, layout);
            return true;
        };

        rcmail.simple_dialog(dialog, rcmail.gettext('listoptionstitle'), save_func, {
            closeOnEscape: true,
            open: function(e) {
                setTimeout(function() { dialog.find('a, input:not(:disabled)').not('[aria-disabled=true]').first().focus(); }, 100);
            },
            minWidth: 500,
            width: width
        });
    };

    /**
     * About dialog
     */
    function about_dialog(elem)
    {
        var support_url, support_func, support_button = false,
            dialog = $('<iframe>').attr({id: 'aboutframe', src: rcmail.url('settings/about', {_framed: 1})}),
            support_link = $('#supportlink');

        // TODO: 'Get Support' link/button
        if (support_link.length && (support_url = support_link.attr('href'))) {
            support_button = support_link.html();
            support_func = function(e) { support_url.indexOf('mailto:') < 0 ? window.open(support_url) : location.href = support_url };
        }

        rcmail.simple_dialog(dialog, $(elem).text(), support_func, {
            button: support_button,
            width: 600,
            height: 400
        });
    };

    /**
     * Search options menu popup
     */
    function searchmenu(obj)
    {
        var n, all,
            list = $('input[name="s_mods[]"]', obj),
            scope_list = $('input[name="s_scope"]', obj),
            mbox = rcmail.env.mailbox,
            mods = rcmail.env.search_mods,
            scope = rcmail.env.search_scope || 'base';

        if (!$(obj).data('initialized')) {
            list.on('click', function() { set_searchmod(this, obj); });
            scope_list.on('click', function() { rcmail.set_searchscope(this.value); });
            $(obj).data('initialized', true);
        }

        if (rcmail.env.search_mods) {
            if (rcmail.env.task == 'mail') {
                if (scope == 'all') {
                    mbox = '*';
                }

                mods = mods[mbox] ? mods[mbox] : mods['*'];
                all = 'text';
                scope_list.prop('checked', false).filter('#s_scope_' + scope).prop('checked', true);
            }
            else {
                all = '*';
            }

            if (mods[all]) {
                list.map(function() {
                    this.checked = true;
                    this.disabled = this.value != all;
                });
            }
            else {
                list.prop('disabled', false).prop('checked', false);
                for (n in mods) {
                    $('#s_mod_' + n).prop('checked', true);
                }
            }
        }
    };

    function set_searchmod(elem, menu)
    {
        var all, m, task = rcmail.env.task,
            mods = rcmail.env.search_mods,
            mbox = rcmail.env.mailbox,
            scope = $('input[name="s_scope"]:checked', menu).val();

        if (scope == 'all') {
            mbox = '*';
        }

        if (!mods) {
            mods = {};
        }

        if (task == 'mail') {
            if (!mods[mbox]) {
                mods[mbox] = rcube_clone_object(mods['*']);
            }
            m = mods[mbox];
            all = 'text';
        }
        else { //addressbook
            m = mods;
            all = '*';
        }

        if (!elem.checked) {
            delete(m[elem.value]);
        }
        else {
            m[elem.value] = 1;
        }

        // mark all fields
        if (elem.value == all) {
            $('input[name="s_mods[]"]', menu).map(function() {
                if (this == elem) {
                    return;
                }

                this.checked = true;

                if (elem.checked) {
                    this.disabled = true;
                    delete m[this.value];
                }
                else {
                    this.disabled = false;
                    m[this.value] = 1;
                }
            });
        }

        rcmail.set_searchmods(m);
    };

    /**
     * Spellcheck languages list
     */
    function spellmenu(obj)
    {
        var i, link, li, list = [],
            lang = rcmail.spellcheck_lang(),
            ul = $('ul', obj);

        if (!ul.length) {
            ul = $('<ul class="toolbarmenu selectable listing iconized" role="menu">');

            for (i in rcmail.env.spell_langs) {
                li = $('<li role="menuitem">');
                link = $('<a href="#'+ i +'" tabindex="0"></a>')
                    .text(rcmail.env.spell_langs[i])
                    .addClass('active').data('lang', i)
                    .on('click keypress', function(e) {
                        if (e.type != 'keypress' || rcube_event.get_keycode(e) == 13) {
                            rcmail.spellcheck_lang_set($(this).data('lang'));
//                            rcmail.hide_menu('spellmenu', e);
                            return false;
                        }
                    });

                link.appendTo(li);
                list.push(li);
            }

            ul.append(list).appendTo(obj);
        }

        // select current language
        $('li', ul).each(function() {
            var el = $('a', this);
            if (el.data('lang') == lang) {
                el.addClass('selected').attr('aria-selected', 'true');
            }
            else if (el.hasClass('selected')) {
                el.removeClass('selected').removeAttr('aria-selected');
            }
        });
    };

    /**
     * Attachment menu
     */
    function attachmentmenu(obj, button, event)
    {
        var id = $(button).parent().attr('id').replace(/^attach/, '');

        $.each(['open', 'download', 'rename'], function() {
            var action = this;
            $('#attachmenu' + action, obj).off('click').attr('onclick', '').click(function(e) {
                return rcmail.command(action + '-attachment', id, this);
            });
        });

        // call menu-open so core can set state of menu commands
        rcmail.command('menu-open', {menu: 'attachmentmenu', id: id}, obj, event);
    };

    /**
     * Appends drop-icon to attachments list item (to invoke attachment menu)
     */
    function attachmentmenu_append(item)
    {
        item = $(item);

        if (!item.children('.drop').length) {
            var button = $('<a>')
                .attr({
                    href: '#',
                    tabindex: 0,
                    'class': 'button icon dropdown skip-content',
                    'data-popup': 'attachment-menu',
                })
                .append($('<span class="inner">').text('Show options')) // TODO: Localize "Show options" below
                .appendTo(item);

            popup_init(button);
        }
    };
}

var UI = new rcube_elastic_ui();
