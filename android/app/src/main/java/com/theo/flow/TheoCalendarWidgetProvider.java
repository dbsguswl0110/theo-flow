package com.theo.flow;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;
import org.json.JSONArray;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Calendar provider rebuilt around a single ImageView. Receiver identity stays compatible with installed widgets. */
public class TheoCalendarWidgetProvider extends AppWidgetProvider {
    private static final String API="https://theo-flow.dbsguswl0110.workers.dev/api/items";
    private static final AtomicBoolean syncing=new AtomicBoolean(false);
    private static final String STORE="teo-calendar-v2";
    static JSONArray cached(Context context){
        try{return new JSONArray(context.getSharedPreferences(STORE,0).getString("items","[]"));}
        catch(Exception e){return new JSONArray();}
    }
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids)render(context,manager,id,false);
    }
    @Override public void onAppWidgetOptionsChanged(Context context,AppWidgetManager manager,int id,Bundle options){
        render(context,manager,id,false);
    }
    @Override public void onReceive(Context context,Intent intent){
        super.onReceive(context,intent);
        String action=intent.getAction();
        if(Intent.ACTION_DATE_CHANGED.equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action)){
            refreshAll(context,false);return;
        }
        if(!AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)
            &&!AppWidgetManager.ACTION_APPWIDGET_OPTIONS_CHANGED.equals(action)
            &&!"com.theo.flow.WIDGET_REFRESH".equals(action))return;
        if(!syncing.compareAndSet(false,true))return;
        PendingResult pending=goAsync();Context app=context.getApplicationContext();
        new Thread(()->{
            HttpURLConnection connection=null;
            try{
                connection=(HttpURLConnection)new URL(API).openConnection();
                connection.setConnectTimeout(3000);connection.setReadTimeout(3000);connection.setUseCaches(false);
                if(connection.getResponseCode()!=200)throw new java.io.IOException("HTTP "+connection.getResponseCode());
                StringBuilder data=new StringBuilder();
                try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),"UTF-8"))){
                    String line;while((line=reader.readLine())!=null)data.append(line);
                }
                JSONArray items=new JSONArray(data.toString());
                app.getSharedPreferences(STORE,0).edit().putString("items",items.toString()).putBoolean("loaded",true).apply();
                refreshAll(app,false);
            }catch(Exception e){refreshAll(app,true);}
            finally{if(connection!=null)connection.disconnect();syncing.set(false);pending.finish();}
        },"teo-calendar-sync").start();
    }
    static void refreshAll(Context context,boolean failed){
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        for(int id:manager.getAppWidgetIds(new ComponentName(context,TheoCalendarWidgetProvider.class)))render(context,manager,id,failed);
    }
    static RemoteViews frame(Context context,int id,int width,int height,LocalDate today,JSONArray data,boolean pending,float scale){
        RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.teo_calendar_canvas);
        views.setImageViewBitmap(R.id.calendar_image,CalendarPainter.draw(width,height,today,CalendarData.parse(data),pending,scale));
        views.setContentDescription(R.id.calendar_image,today.getYear()+"년 "+today.getMonthValue()+"월 캘린더. Todo와 Task. 탭하면 TEO를 엽니다.");
        Intent open=new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.calendar_root,PendingIntent.getActivity(context,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        return views;
    }
    static void render(Context context,AppWidgetManager manager,int id,boolean failed){
        Bundle options=manager.getAppWidgetOptions(id);List<SizeF> sizes=new ArrayList<>();
        if(Build.VERSION.SDK_INT>=31){
            ArrayList<SizeF> supplied=options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if(supplied!=null)for(SizeF s:supplied)if(s.getWidth()>0&&s.getHeight()>0&&!sizes.contains(s)&&sizes.size()<8)sizes.add(s);
        }
        if(sizes.isEmpty())sizes.add(new SizeF(
            Math.max(180,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,320)),
            Math.max(220,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,360))));
        double area=0;for(SizeF s:sizes)area+=s.getWidth()*s.getHeight();
        // Bound all bitmaps together to 2 MB, independent of the number of Fold display sizes.
        float scale=(float)Math.min(2,Math.sqrt(500000/area));
        JSONArray data=cached(context);
        boolean pending=failed||!context.getSharedPreferences(STORE,0).getBoolean("loaded",false);
        Map<SizeF,RemoteViews> frames=new LinkedHashMap<>();
        for(SizeF s:sizes)frames.put(s,frame(context,id,Math.round(s.getWidth()),Math.round(s.getHeight()),LocalDate.now(),data,pending,scale));
        manager.updateAppWidget(id,Build.VERSION.SDK_INT>=31?new RemoteViews(frames):frames.values().iterator().next());
    }
}
