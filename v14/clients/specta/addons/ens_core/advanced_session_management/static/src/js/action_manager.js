odoo.define('advanced_session_management.action_manager',function(require){
    'user strict'
    var ajax = require('web.ajax');
    $(window).on('hashchange', function(e){
        var url = window.location.href;
        ajax.jsonRpc('/get/ip_params','call',{}).then(function (data) {
            if (data.ip_key && data.ip_url){
                $.getJSON(data.ip_url).then(function(ip_json){
                    data = {
                        'data':url,
                        'ip':ip_json[data.ip_key]
                    }
                    ajax.jsonRpc('/post/action_data','call',data);
                });
            }
        });

    });
});
