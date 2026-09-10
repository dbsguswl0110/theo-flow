package com.theo.flow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Small launcher widget for quickly opening a specific TEO collection. */
public class TheoMemoWidgetProvider extends AppWidgetProvider {
    private void bind(RemoteViews views, Context context, int id, int viewId, String mode) {
        Intent intent = new Intent(context, MainActivity.class).putExtra("theo_open", mode);
        PendingIntent pending = PendingIntent.getActivity(context, id * 10 + viewId,
            intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pending);
    }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.theo_memo_widget);
            bind(views, context, id, R.id.memo_widget_note, "note");
            bind(views, context, id, R.id.memo_widget_task, "task");
            bind(views, context, id, R.id.memo_widget_todo, "todo");
            bind(views, context, id, R.id.memo_widget_calendar, "calendar");
            manager.updateAppWidget(id, views);
        }
    }
}
