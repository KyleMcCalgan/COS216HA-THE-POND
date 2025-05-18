# COS216HA-THE-POND
homework assignment github repository for COS216 used by THE POND 
V3XFTDELNDKKFFU27VMF7H65QAGVDMHX


Task3-angular-frontend = version 17 this is the new one 
Task3-angular-client = version 19 ie the old one with all the current correct html files 

TEST is a folder used to test a nodejs server 
currently you can use it to test out all of the API cases 
start the server by running the following:
    -make sure nodejs v20.19.1 is installed
    -install what ever additional pages dont work most likely:
        - npm install express http ws path axios body-parser readline cors
    -make sure xampp is running to make use of the API currently
    -run cd TEST
    -npm install
    -node server.js
    -follow instructions in terminal 


AVAIALBLE: is drone available == true and no order ID

DELIVERING: is drone available == false and order ID not null

WAITING_TO_DELIVER is drone available == true and order ID not null

DEAD: is drone available == false and order ID not null and altitude > 30 or battery == 0