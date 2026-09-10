package com.theo.flow;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) { super.onCreate(state); dispatchWidgetIntent(getIntent()); }
    @Override public void onResume() { super.onResume(); refreshCalendarWidget(); }
    @Override public void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); dispatchWidgetIntent(intent); }
    private void dispatchWidgetIntent(Intent intent) {
        String mode = intent == null ? null : intent.getStringExtra("theo_open");
        if (mode == null || getBridge() == null) return;
        String script = "window.dispatchEvent(new CustomEvent('theo-widget-open',{detail:'" + mode.replace("'", "") + "'}));";
        for (int delay : new int[]{900, 1800, 3000})
            getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(script, null), delay);
    }
    private void refreshCalendarWidget() {
        Intent refresh = new Intent(this, TheoCalendarWidgetProvider.class)
            .setAction("com.theo.flow.WIDGET_REFRESH");
        sendBroadcast(refresh);
    }
}
