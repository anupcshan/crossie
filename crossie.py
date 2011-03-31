#!/usr/bin/python

import ImageFile

fp = open("2011033099951001.jpg", "rb")
p = ImageFile.Parser()
while 1:
	s = fp.read(1024)
	if not s:
			break
	p.feed(s)

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
for i in range(0, length):
	arr[i] = {}

for i in range(0, length):
	for j in range(0, length):
		x = boxx * (i + 0.5)
		y = boxy * (j + 0.5)
#		print j, i, im.getpixel((x, y))
		arr[j][i] = (im.getpixel((x, y)) == (255, 255, 255))
#		im.putpixel((x, y), (255, 0, 0))
	
for i in range(0, length):
	for j in range(0, length):
		if arr[i][j] == True:
			print "1",
		else:
			print "0",
	print ""

#im.save("copy.jpg")
