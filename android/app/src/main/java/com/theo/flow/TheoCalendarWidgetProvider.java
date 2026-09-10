package com.theo.flow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/** Fold large widget: left task snapshot, right current-month calendar.
 * It reads the same Cloudflare D1-backed API as the web app; it has no local task database. */
public class TheoCalendarWidgetProvider extends AppWidgetProvider {
    private static final String API = "https://theo-flow.dbsguswl0110.workers.dev/api/items";
    private static final int BROWN = Color.rgb(104,74,56);
    private static final int MUTED = Color.rgb(168,138,115);
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if ("com.theo.flow.WIDGET_REFRESH".equals(intent.getAction())) {
            AppWidgetManager manager=AppWidgetManager.getInstance(context);
            for (int id: manager.getAppWidgetIds(new android.content.ComponentName(context, TheoCalendarWidgetProvider.class))) update(context,manager,id);
        }
    }
    private void update(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.theo_widget);
        Intent open = new Intent(context, MainActivity.class).putExtra("theo_open", "calendar");
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        views.setTextViewText(R.id.widget_status, "Updating · Tap to open TEO");
        manager.updateAppWidget(id, views);
        new Thread(() -> {
            try {
                HttpURLConnection c=(HttpURLConnection)new URL(API).openConnection(); c.setConnectTimeout(6000); c.setReadTimeout(6000);
                BufferedReader reader=new BufferedReader(new InputStreamReader(c.getInputStream()));
                StringBuilder out=new StringBuilder(); String line; while((line=reader.readLine())!=null)out.append(line); reader.close();
                render(context, manager, id, new JSONArray(out.toString()));
            } catch(Exception e) { views.setTextViewText(R.id.widget_status,"Sync pending · Tap to open TEO"); manager.updateAppWidget(id,views); }
        }).start();
    }
    private void render(Context context, AppWidgetManager manager, int id, JSONArray all) {
        RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.theo_widget);
        Calendar today=Calendar.getInstance(); int year=today.get(Calendar.YEAR), month=today.get(Calendar.MONTH);
        String monthLabel=new SimpleDateFormat("MMMM yyyy",Locale.getDefault()).format(today.getTime());
        views.setTextViewText(R.id.widget_month,monthLabel);
        views.removeAllViews(R.id.widget_tasks); views.removeAllViews(R.id.widget_grid);
        int shown=0;
        for(int i=0;i<all.length()&&shown<5;i++) try {
            JSONObject item=all.getJSONObject(i); String type=item.optString("type");
            if(!"task".equals(type)&&!"todo".equals(type))continue;
            if(item.optBoolean("completed"))continue;
            RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_task);
            row.setTextViewText(R.id.widget_task_title,(type.equals("todo")?"○ ":"□ ")+item.optString("title","Untitled"));
            views.addView(R.id.widget_tasks,row); shown++;
        } catch(Exception ignored){}
        if(shown==0){RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_task);row.setTextViewText(R.id.widget_task_title,"오늘 할 일이 없어요");views.addView(R.id.widget_tasks,row);}
        Calendar first=(Calendar)today.clone(); first.set(Calendar.DAY_OF_MONTH,1); int offset=(first.get(Calendar.DAY_OF_WEEK)+5)%7; int days=today.getActualMaximum(Calendar.DAY_OF_MONTH);
        for(int cell=0;cell<42;cell++){RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.theo_widget_cell);int day=cell-offset+1;String text=day>0&&day<=days?String.valueOf(day):"";v.setTextViewText(android.R.id.text1,text);if(day==today.get(Calendar.DAY_OF_MONTH))v.setTextColor(android.R.id.text1,Color.WHITE);views.addView(R.id.widget_grid,v);}
        views.setTextViewText(R.id.widget_status,"Updated "+new SimpleDateFormat("h:mm a",Locale.getDefault()).format(today.getTime())+" · Tap to open TEO");
        manager.updateAppWidget(id,views);
    }
}
