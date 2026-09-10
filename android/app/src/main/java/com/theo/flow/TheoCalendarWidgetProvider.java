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
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) {
        update(context, manager, id);
    }
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
        try {
            render(context,manager,id,new JSONArray(context.getSharedPreferences("widget",0).getString("items","[]")));
        } catch(Exception ignored) { render(context,manager,id,new JSONArray()); }
        new Thread(() -> {
            try {
                HttpURLConnection c=(HttpURLConnection)new URL(API).openConnection(); c.setConnectTimeout(6000); c.setReadTimeout(6000);
                BufferedReader reader=new BufferedReader(new InputStreamReader(c.getInputStream()));
                StringBuilder out=new StringBuilder(); String line; while((line=reader.readLine())!=null)out.append(line); reader.close();
                JSONArray items=new JSONArray(out.toString());
                context.getSharedPreferences("widget",0).edit().putString("items",items.toString()).apply();
                render(context, manager, id, items);
                c.disconnect();
            } catch(Exception e) {
                RemoteViews status=new RemoteViews(context.getPackageName(),R.layout.theo_widget);
                status.setTextViewText(R.id.widget_status,"동기화 대기 · 탭하여 열기");
                manager.partiallyUpdateAppWidget(id,status);
            }
        }).start();
    }
    private void render(Context context, AppWidgetManager manager, int id, JSONArray all) {
        RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.theo_widget);
        Calendar today=Calendar.getInstance(); int year=today.get(Calendar.YEAR), month=today.get(Calendar.MONTH);
        String monthLabel=new SimpleDateFormat("yyyy년 M월",Locale.KOREAN).format(today.getTime());
        views.setTextViewText(R.id.widget_month,monthLabel);
        views.removeAllViews(R.id.widget_tasks); views.removeAllViews(R.id.widget_grid);
        int height=manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,280);
        int limit=height>=400?3:height>=340?1:0;
        views.setViewVisibility(R.id.widget_tasks,limit==0?View.GONE:View.VISIBLE);
        int shown=0;
        for(int i=0;i<all.length()&&shown<limit;i++) try {
            JSONObject item=all.getJSONObject(i); String type=item.optString("type");
            if(!"task".equals(type)&&!"todo".equals(type))continue;
            if(item.optBoolean("completed"))continue;
            if(!item.isNull("deletedAt")&&!item.optString("deletedAt").isEmpty())continue;
            RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_task);
            row.setTextViewText(R.id.widget_task_title,(type.equals("todo")?"○ ":"□ ")+item.optString("title","Untitled"));
            views.addView(R.id.widget_tasks,row); shown++;
        } catch(Exception ignored){}
        if(shown==0){RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_task);row.setTextViewText(R.id.widget_task_title,"오늘 할 일이 없어요");views.addView(R.id.widget_tasks,row);}
        Calendar first=(Calendar)today.clone(); first.set(Calendar.DAY_OF_MONTH,1); int offset=(first.get(Calendar.DAY_OF_WEEK)+5)%7; int days=today.getActualMaximum(Calendar.DAY_OF_MONTH);
        views.removeAllViews(R.id.widget_weekdays);
        for(String weekday:new String[]{"M","T","W","T","F","S","S"}){
            RemoteViews heading=new RemoteViews(context.getPackageName(),R.layout.theo_widget_cell);
            heading.setTextViewText(android.R.id.text1,weekday);
            heading.setTextColor(android.R.id.text1,BROWN);
            views.addView(R.id.widget_weekdays,heading);
        }
        int weeks=(offset+days+6)/7;
        for(int week=0;week<weeks;week++){
            RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_week);
            for(int column=0;column<7;column++){
                RemoteViews cell=new RemoteViews(context.getPackageName(),R.layout.theo_widget_cell);
                int day=week*7+column-offset+1;
                cell.setTextViewText(android.R.id.text1,day>0&&day<=days?String.valueOf(day):"");
                cell.setTextColor(android.R.id.text1,Color.BLACK);
                cell.setInt(android.R.id.text1,"setBackgroundResource",day==today.get(Calendar.DAY_OF_MONTH)?R.drawable.theo_widget_today:0);
                row.addView(R.id.widget_week,cell);
            }
            views.addView(R.id.widget_grid,row);
        }
        Intent open=new Intent(context,MainActivity.class);
        views.setOnClickPendingIntent(R.id.widget_root,PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        views.setTextViewText(R.id.widget_status,"Updated "+new SimpleDateFormat("h:mm a",Locale.getDefault()).format(today.getTime())+" · Tap to open TEO");
        manager.updateAppWidget(id,views);
    }
}
