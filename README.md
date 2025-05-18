# COS216HA-THE-POND
homework assignment github repository for COS216 used by THE POND 



Some other useful bits of information:

How to run the program:
-cd Task2-server
-node server.js
(pick a port, the angular client requires port 3000, this is hardcoded for now)\
-new terminal - for control over server
cd Task3-web
-ng serve
follow intstructions (go to localhost:4200)

How to use the program:
once logged in you have two options in terms of signups, you are either signed in as a customer or an operator (courier and dispatch fall under this category)
assuming you log in as a customer:
    -you have the ability to place new order by selecting from a list of available products this order will then be sent to storage
    -you have the ability to view ongoing deliveries and see where they are on the map, this map updates every 30 seconds 
    -you have the ability to view past orders that have been completed
    -you can also play a flappy bird like game while you wait
assuming you log in as an operator:
    -you are met with the operator dashboard where you are able to load an order onto a drone
    -you are able to control currently delivering drones or drones that havent left the HQ as of yet
    -you can see past orders 

Some other bits of information around decisions made in the code:
 Majority of the time the drone is categorised into 1 of 4 main categories which are:

    AVAIALBLE: is drone available == true and no order ID

    DELIVERING: is drone available == false and order ID not null

    WAITING_TO_DELIVER is drone available == true and order ID not null

    DEAD: is drone available == false and order ID not null and altitude > 30 or battery == 0

this decision was made to help visually distinguish and provide functionality to operators, in hindsight a field in the database would be far more appropriate even if it isnt correct normalisation

with regards to how deliveries are handled a field was added to the drone table called Order_ID when an order is loaded onto a drone this change is reflected and we can see it in the database 


MORE SPECIFIC READMES are available in TASK1 and TASK2




