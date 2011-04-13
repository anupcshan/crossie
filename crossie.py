#!/usr/bin/python

import ImageFile
import sys
import re
import urllib2
import datetime

if len(sys.argv[1:]) == 0:
	today = datetime.datetime.today()
	year = today.year.__str__()
	month = today.month.__str__()
	day = today.day.__str__()
elif len(sys.argv[1:]) < 3:
	print "Error : Not enough arguments provided."
	print "Usage :", sys.argv[0], "yyyy mm dd"
	exit(-1)
else:
	year, month, day = sys.argv[1:]

print "// Getting crossword page for " + day + "/" + month + "/" + year
year = int(year)
month = int(month)
day = int(day)
filename = (((year * 100 + month) * 100) + day) * 100000000 + 99951000
pageurl = "http://www.hindu.com/thehindu/thscrip/print.pl?file=" + filename.__str__() + ".htm&date=" + year.__str__().zfill(4) + "/" + month.__str__().zfill(2) +"/" + day.__str__().zfill(2) + "/&prd=th&"
imgurl = "http://www.hindu.com/" + year.__str__().zfill(4) + "/" + month.__str__().zfill(2) +"/" + day.__str__().zfill(2) + "/images/" + (filename + 1).__str__() + ".jpg"
print "// HTML scraped from", pageurl
print "// Image downloaded from", imgurl

imgfp = urllib2.urlopen(imgurl)
p = ImageFile.Parser()
p.feed(imgfp.read())
im = p.close()
dimx, dimy = im.size

black = 0
gray = 210
white = 255
length = 15
boxx = dimx*1.0 / length
boxy = dimy*1.0 / length

for i in range(0, dimx):
	s = ""
	for j in range(0, dimy):
		r, g, b = im.getpixel((i, j))
#		s += r.__str__() + ", "
		c0 = abs(r - black)
		c1 = abs(r - gray)
		c2 = abs(r - white)
		if c0 < c1 and c0 < c2:
			clr = black
		elif c1 < c0 and c1 < c2:
			clr = gray
		else:
			clr = white
		im.putpixel((i, j), (clr, clr, clr))
#	print s

arr = {}
across = {}
down = {}
startlist = {}
for i in range(0, length):
	arr[i] = {}
	across[i] = {}
	down[i] = {}

for i in range(0, length):
	for j in range(0, length):
		x = boxx * (i + 0.5)
		y = boxy * (j + 0.5)
#		print j, i, im.getpixel((x, y))
		if (im.getpixel((x, y)) == (255, 255, 255)):
			arr[j][i] = 1
		else:
			arr[j][i] = 0
#		im.putpixel((x, y), (255, 0, 0))

print "matrix = [",
for i in range(0, length):
	if i >= 1:
		print ","
	print "[",
	for j in range(0, length):
		if j >= 1:
			print ",",
		down[i][j] = across[i][j] = 0
		if arr[i][j] == 1:
			down[i][j] = across[i][j] = 1
			print "1",
			if i > 0:
				down[i][j] = down[i-1][j] + 1
				if down[i][j] == 2:
					if startlist.get((i-1, j)):
						startlist[(i-1, j)] += 1
					else:
						startlist[(i-1, j)] = 1
			if j > 0:
				across[i][j] = across[i][j-1] + 1
				if across[i][j] == 2:
					if startlist.get((i, j-1)):
						startlist[(i, j-1)] += 2
					else:
						startlist[(i, j-1)] = 2
		else:
			print "0",
	print "]",
print "];"

starts = startlist.keys()
starts.sort()
print "startpos = [",

i = 0
for startpos in starts:
	if i > 0:
		print ",",
	print "[", startpos[0], ",", startpos[1], ",", startlist[startpos], "]",
	i = i + 1
print "];"
#im.save("copy.jpg")


# Done with image stuff. Now to get the clues.
page = urllib2.urlopen(pageurl).read().split('\r\n')
across = {}
down = {}
prevcnum = 0
crossienum = None
author = None
isacross = True

for line in page:
	if crossienum == None:
		if re.match('The Hindu Crossword [0-9][0-9]*', line):
			crossienum = re.search('The Hindu Crossword ([0-9][0-9]*)', line).groups()[0]
	if author == None:
		if re.match('^[a-zA-z][a-zA-Z ]*$', line):
			author = line
	if re.match('<p>\s*[0-9][0-9]*', line):
		cnum, clue, chars = re.search('<p>\s*([0-9][0-9]*)\ (.*) (\([0-9,-]*\))', line).groups()
		cnum = int(cnum)
		if isacross:
			if cnum < prevcnum:
				isacross = False

		prevcnum = cnum
		if isacross:
			across[cnum] = {'clue': clue, 'chars': chars}
		else:
			down[cnum] = {'clue': clue, 'chars': chars}

print "crossienum =", crossienum, ";"
print "author = '" + author + "';"
print "across = {"
i = 0
for clue in across:
	if i > 0:
		print ","
	print clue, ':', across[clue],
	i = i + 1
print "};"

print "down = {"
i = 0
for clue in down:
	if i > 0:
		print ","
	print clue, ':', down[clue],
	i = i + 1
print "};"
