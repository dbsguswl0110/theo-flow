package com.theo.flow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Data refreshes never change the calendar's geometry: six rows and two event lanes. */
public class TheoCalendarWidgetProvider extends AppWidgetProvider {
    private static final String API="https://theo-flow.dbsguswl0110.workers.dev/api/items";
    private static final int LANES=2;
    static String field(JSONObject item,String camel,String snake) {
        return item.isNull(camel)?item.optString(snake,""):item.optString(camel,"");
    }
    static boolean active(JSONObject item) {
        return field(item,"deletedAt","deleted_at").isEmpty()
            && !item.optBoolean("completed") && item.optInt("completed",0)!=1;
    }
    static final class Event {
        String id,title,start,end;
        boolean duration;
        int lane=-1;
        Event(JSONObject item,String fallback) {
            id=item.optString("id"); title=item.optString("title","제목 없음");
            start=field(item,"startDate","start_date");
            if(start.isEmpty())start=fallback;
            String due=field(item,"dueDate","due_date");
            duration=!due.isEmpty()&&due.compareTo(start)>=0;
            end=duration?due:start;
        }
    }
    static List<Event> events(JSONArray all) {
        List<Event> out=new ArrayList<>();
        for(int i=0;i<all.length();i++){
            JSONObject item=all.optJSONObject(i);
            if(item==null||!active(item))continue;
            String type=item.optString("type");
            if(!"task".equals(type)&&!"todo".equals(type))continue;
            Event parent=new Event(item,"");
            if(parent.start.matches("\\d{4}-\\d{2}-\\d{2}"))out.add(parent);
            JSONArray children=item.optJSONArray("subTodos");
            if(children==null)children=item.optJSONArray("subtasks");
            if(children!=null)for(int j=0;j<children.length();j++){
                JSONObject child=children.optJSONObject(j);
                if(child!=null&&active(child)){
                    Event event=new Event(child,parent.start);
                    if(event.start.matches("\\d{4}-\\d{2}-\\d{2}"))out.add(event);
                }
            }
        }
        out.sort(Comparator.comparing((Event e)->e.start).thenComparing(e->e.id));
        return out;
    }
    private JSONArray cached(Context context){
        try{return new JSONArray(context.getSharedPreferences("widget",0).getString("items","[]"));}
        catch(Exception e){return new JSONArray();}
    }
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        JSONArray all=cached(context);
        for(int id:ids)render(context,manager,id,all);
    }
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int id,Bundle options){
        render(context,manager,id,cached(context));
    }
    @Override public void onReceive(Context context,Intent intent){
        super.onReceive(context,intent);
        String action=intent.getAction();
        if(!AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
            &&!AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(action)
            &&!"com.theo.flow.WIDGET_REFRESH".equals(action))return;
        final PendingResult pending=goAsync();
        final Context app=context.getApplicationContext();
        new Thread(()->{
            HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(API).openConnection();
                connection.setConnectTimeout(3000);connection.setReadTimeout(3000);
                StringBuilder output=new StringBuilder();
                try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),"UTF-8"))){
                    String line;while((line=reader.readLine())!=null)output.append(line);
                }
                JSONArray all=new JSONArray(output.toString());
                app.getSharedPreferences("widget",0).edit().putString("items",all.toString())
                    .putLong("syncedAt",System.currentTimeMillis()).apply();
                AppWidgetManager manager=AppWidgetManager.getInstance(app);
                for(int id:manager.getAppWidgetIds(new ComponentName(app,TheoCalendarWidgetProvider.class)))
                    render(app,manager,id,all);
            }catch(Exception ignored){
                // Keep the cached calendar and its original sync time, including identical dimensions.
            }finally{
                if(connection!=null)connection.disconnect();
                pending.finish();
            }
        },"teo-widget-sync").start();
    }
    private void render(Context context,AppWidgetManager manager,int id,JSONArray all){
        RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.theo_widget);
        Calendar today=Calendar.getInstance();
        SimpleDateFormat key=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);
        String todayKey=key.format(today.getTime());
        int month=today.get(Calendar.MONTH);
        Calendar first=(Calendar)today.clone();first.set(Calendar.DAY_OF_MONTH,1);
        first.add(Calendar.DAY_OF_MONTH,-(first.get(Calendar.DAY_OF_WEEK)+5)%7);
        String[] dates=new String[42];boolean[] inMonth=new boolean[42];
        for(int i=0;i<42;i++){dates[i]=key.format(first.getTime());inMonth[i]=first.get(Calendar.MONTH)==month;first.add(Calendar.DAY_OF_MONTH,1);}
        List<Event> events=events(all);
        Event[][] slots=new Event[42][LANES];int[] counts=new int[42];
        for(Event event:events){
            if(event.end.compareTo(dates[0])<0||event.start.compareTo(dates[41])>0)continue;
            int begin=0,end=41;
            while(begin<42&&dates[begin].compareTo(event.start)<0)begin++;
            while(end>=0&&dates[end].compareTo(event.end)>0)end--;
            for(int d=begin;d<=end;d++)if(inMonth[d])counts[d]++;
            for(int lane=0;lane<LANES;lane++){
                boolean available=true;
                for(int d=begin;d<=end;d++)if(slots[d][lane]!=null)available=false;
                if(available){event.lane=lane;for(int d=begin;d<=end;d++)slots[d][lane]=event;break;}
            }
        }
        views.setTextViewText(R.id.widget_month,new SimpleDateFormat("yyyy년 M월",Locale.KOREAN).format(today.getTime()));
        views.removeAllViews(R.id.widget_weekdays);views.removeAllViews(R.id.widget_grid);
        for(String label:new String[]{"M","T","W","T","F","S","S"}){
            RemoteViews heading=new RemoteViews(context.getPackageName(),R.layout.theo_widget_heading);
            heading.setTextViewText(android.R.id.text1,label);views.addView(R.id.widget_weekdays,heading);
        }
        for(int week=0;week<6;week++){
            RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.theo_widget_week);
            for(int column=0;column<7;column++){
                int d=week*7+column,shown=0;
                RemoteViews cell=new RemoteViews(context.getPackageName(),R.layout.theo_widget_cell);
                cell.setTextViewText(android.R.id.text1,inMonth[d]?String.valueOf(Integer.parseInt(dates[d].substring(8))):"");
                cell.setTextColor(android.R.id.text1,dates[d].equals(todayKey)?Color.rgb(220,35,45):Color.BLACK);
                cell.removeAllViews(R.id.widget_events);
                StringBuilder accessible=new StringBuilder(dates[d]);
                for(int lane=0;lane<LANES;lane++){
                    Event event=inMonth[d]?slots[d][lane]:null;
                    RemoteViews badge=new RemoteViews(context.getPackageName(),R.layout.theo_widget_event);
                    boolean visible=event!=null;
                    boolean duration=visible&&event.duration;
                    boolean label=visible&&(!duration||column==0||dates[d].equals(event.start)||dates[d].endsWith("-01"));
                    badge.setTextViewText(R.id.widget_event_title,label?event.title:"");
                    badge.setViewVisibility(R.id.widget_event_dot,visible&&!duration?View.VISIBLE:View.INVISIBLE);
                    badge.setViewVisibility(R.id.widget_event_line,duration?View.VISIBLE:View.INVISIBLE);
                    if(visible){shown++;accessible.append(", ").append(event.title);}
                    cell.addView(R.id.widget_events,badge);
                }
                int more=Math.max(0,counts[d]-shown);
                cell.setTextViewText(R.id.widget_more,more>0?"+"+more:"");
                cell.setContentDescription(android.R.id.text1,accessible.toString());
                row.addView(R.id.widget_week,cell);
            }
            views.addView(R.id.widget_grid,row);
        }
        Intent open=new Intent(context,MainActivity.class);
        views.setOnClickPendingIntent(R.id.widget_root,PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        long synced=context.getSharedPreferences("widget",0).getLong("syncedAt",0);
        views.setTextViewText(R.id.widget_status,synced==0?"동기화 대기":new SimpleDateFormat("HH:mm",Locale.KOREAN).format(new java.util.Date(synced))+" 동기화 · 탭하여 열기");
        manager.updateAppWidget(id,views);
    }
}
