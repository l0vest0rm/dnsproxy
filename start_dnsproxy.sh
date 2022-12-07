#!/bin/bash
#nohup sh start_local.sh &

filepath=$(cd `dirname $0`; pwd)
bashpath=$filepath
cd $bashpath

PROGRAM=dnsproxy

if [ ! -d "$bashpath/log" ]; then
  mkdir $bashpath/log
fi

#./dnsproxy -u 8.8.8.8:53 --cache -v -o log.txt
# ./dnsproxy -u 8.8.8.8 --cache --cache-max-ttl=600

while true
do
  procnum=`ps -ef|grep "$PROGRAM"|grep -v grep|grep -v start|wc -l`
  if [ $procnum -eq 0 ]; then
    logfile="log/$PROGRAM.log"
    timestamp=`date "+%Y%m%d-%H%M%S"`
    if [ -f $logfile ]; then
      mv $logfile $logfile.$timestamp
    fi
    touch $logfile
    $bashpath/dnsproxy -u 8.8.8.8 --cache --cache-max-ttl=600 1>$logfile 2>$logfile
  fi
  sleep 3
done
